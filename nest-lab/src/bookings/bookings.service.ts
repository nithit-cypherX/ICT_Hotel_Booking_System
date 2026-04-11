import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { Role } from '@prisma/client';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // FR-17, FR-18: logged-in user creates a booking
  // userId comes from the JWT token — never from the request body
  async create(userId: number, createBookingDto: CreateBookingDto) {
    try {
      const { roomId, checkIn, checkOut } = createBookingDto;
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      // FR-19: checkIn must be strictly before checkOut
      if (checkInDate >= checkOutDate) {
        this.logger.error(
          `Create booking failed: checkIn (${checkIn}) is not before checkOut (${checkOut}) for user #${userId}`,
        );
        throw new BadRequestException('checkIn must be before checkOut');
      }

      // Verify the room exists and is currently active
      const room = await this.prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        this.logger.error(
          `Create booking failed: Room #${roomId} does not exist`,
        );
        throw new NotFoundException(`Room #${roomId} not found`);
      }
      if (!room.isActive) {
        this.logger.error(
          `Create booking failed: Room #${roomId} is not active`,
        );
        throw new BadRequestException(
          `Room #${roomId} is not available for booking`,
        );
      }

      // FR-20: prevent double booking
      // A conflict exists when an active booking's window overlaps with ours:
      //   existing.checkIn  < our checkOut  (it starts before we leave)
      //   existing.checkOut > our checkIn   (it ends after we arrive)
      const conflict = await this.prisma.booking.findFirst({
        where: {
          roomId,
          status: { notIn: ['CANCELLED'] },
          AND: [
            { checkIn: { lt: checkOutDate } },
            { checkOut: { gt: checkInDate } },
          ],
        },
      });
      if (conflict) {
        this.logger.error(
          `Create booking failed: Room #${roomId} already booked — conflict with booking #${conflict.id}`,
        );
        throw new BadRequestException(
          'Room is already booked for the selected dates',
        );
      }

      // FR-22: always force PENDING — status is never trusted from the client
      const newBooking = await this.prisma.booking.create({
        data: {
          userId,
          roomId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          status: 'PENDING',
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          room: true,
        },
      });

      // FR-30: record notification so the frontend can inform the user
      await this.notifications.create({
        userId: newBooking.userId,
        bookingId: newBooking.id,
        type: 'BOOKING_CREATED',
        message: `Your booking for "${room.name}" (${checkInDate.toDateString()} → ${checkOutDate.toDateString()}) is pending approval.`,
      });

      this.logger.log(
        `Successfully created booking #${newBooking.id} — user #${userId}, room #${roomId}`,
      );

      return newBooking;
    } catch (error) {
      this.logger.error(`Failed to create booking: ${error.message}`);
      throw error;
    }
  }

  // FR-23, FR-25: admins see all bookings, regular users see only their own
  async findAll(userId: number, role: Role) {
    if (role === Role.ADMIN) {
      const bookings = await this.prisma.booking.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          room: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      this.logger.log(
        `Admin #${userId} fetched all bookings — count: ${bookings.length}`,
      );
      return bookings;
    }

    // Regular user — return only their own bookings
    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { createdAt: 'desc' },
    });
    this.logger.log(
      `User #${userId} fetched their own bookings — count: ${bookings.length}`,
    );
    return bookings;
  }

  // FR-24, FR-25: admin can see any booking, user can only see their own
  async findOne(bookingId: number, userId: number, role: Role) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        room: true,
      },
    });

    if (!booking) {
      this.logger.error(
        `Validation failed: Booking #${bookingId} does not exist`,
      );
      throw new NotFoundException(`Booking #${bookingId} not found`);
    }

    // Regular users cannot view bookings that belong to someone else
    if (role !== Role.ADMIN && booking.userId !== userId) {
      this.logger.error(
        `Access denied: User #${userId} tried to access booking #${bookingId} owned by user #${booking.userId}`,
      );
      throw new ForbiddenException(
        'You do not have permission to view this booking',
      );
    }

    this.logger.log(
      `Booking #${bookingId} fetched by ${role === Role.ADMIN ? 'admin' : 'user'} #${userId}`,
    );
    return booking;
  }

  // FR-26: admin updates booking status only
  async updateStatus(
    bookingId: number,
    updateStatusDto: UpdateStatusDto,
    adminId: number,
  ) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { room: true },
      });

      if (!booking) {
        this.logger.error(
          `updateStatus failed: Booking #${bookingId} does not exist`,
        );
        throw new NotFoundException(`Booking #${bookingId} not found`);
      }

      // Prevent transitioning from a terminal state
      if (booking.status === 'CANCELLED') {
        this.logger.error(
          `updateStatus failed: Booking #${bookingId} is already cancelled`,
        );
        throw new BadRequestException(
          'Cannot update status of a cancelled booking',
        );
      }
      if (booking.status === 'PAID') {
        this.logger.error(
          `updateStatus failed: Booking #${bookingId} is already paid`,
        );
        throw new BadRequestException('Cannot update status of a paid booking');
      }

      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: updateStatusDto.status },
        include: {
          user: { select: { id: true, name: true, email: true } },
          room: true,
        },
      });

      // FR-31: fire cancellation notification only when transitioning to CANCELLED
      if (updateStatusDto.status === 'CANCELLED') {
        await this.notifications.create({
          userId: booking.userId,
          bookingId,
          type: 'BOOKING_CANCELLED',
          message: `Your booking #${bookingId} for "${booking.room.name}" has been cancelled.`,
        });
        this.logger.log(
          `Cancellation notification sent for booking #${bookingId} to user #${booking.userId}`,
        );
      }

      this.logger.log(
        `Admin #${adminId} updated booking #${bookingId} status: ${booking.status} → ${updateStatusDto.status}`,
      );

      return updatedBooking;
    } catch (error) {
      this.logger.error(
        `Failed to update status for booking #${bookingId}: ${error.message}`,
      );
      throw error;
    }
  }

  // Admin hard delete — only if needed for cleanup
  async remove(bookingId: number, adminId: number) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        this.logger.error(
          `Delete failed: Booking #${bookingId} does not exist`,
        );
        throw new NotFoundException(`Booking #${bookingId} not found`);
      }

      await this.prisma.booking.delete({ where: { id: bookingId } });

      this.logger.log(
        `Admin #${adminId} deleted booking #${bookingId} successfully`,
      );

      return { message: `Booking #${bookingId} has been deleted` };
    } catch (error) {
      this.logger.error(
        `Failed to delete booking #${bookingId}: ${error.message}`,
      );
      throw error;
    }
  }
}
