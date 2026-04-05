import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {

  private readonly logger = new Logger(RoomsService.name);

  constructor(private readonly prisma: PrismaService) { }

  async create(createRoomDto: CreateRoomDto) {
    try {
      const newRoom = await this.prisma.room.create({
        data: createRoomDto,
      });
      this.logger.log(`Successfully created room: ${newRoom.name}`);
      return newRoom;
    } catch (error) {
      this.logger.error(`Failed to create room: ${error.message}`);
      throw error;
    }
  }

  // FR-12: public listing shows only active rooms
  async findAll() {
    const rooms = await this.prisma.room.findMany({
      where: { isActive: true },
    });
    this.logger.log(`Fetched all active rooms — count: ${rooms.length}`);
    return rooms;
  }

  async findOne(id: number) {
    const room = await this.prisma.room.findUnique({ where: { id } });

    if (!room) {
      this.logger.error(`Validation failed: Room #${id} does not exist`);
      throw new NotFoundException(`Room #${id} not found`);
    }

    return room;
  }

  async update(id: number, updateRoomDto: UpdateRoomDto) {
    try {
      await this.findOne(id); // throws 404 if room does not exist

      const updatedRoom = await this.prisma.room.update({
        where: { id },
        data: updateRoomDto,
      });

      this.logger.log(`Successfully updated room: ${updatedRoom.name}`);
      return updatedRoom;
    } catch (error) {
      this.logger.error(`Failed to update room #${id}: ${error.message}`);
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.findOne(id); // throws 404 if room does not exist

      const deletedRoom = await this.prisma.room.delete({ where: { id } });

      this.logger.log(`Successfully deleted room: ${deletedRoom.name}`);
      return deletedRoom;
    } catch (error) {
      this.logger.error(`Failed to delete room #${id}: ${error.message}`);
      throw error;
    }
  }

  // FR-10: soft deactivate — keeps the room in the DB but hides it from listings
  async disable(id: number) {
    try {
      await this.findOne(id); // throws 404 if room does not exist

      const room = await this.prisma.room.update({
        where: { id },
        data: { isActive: false },
      });

      this.logger.log(`Successfully disabled room ID: ${id}`);
      return room;
    } catch (error) {
      this.logger.error(`Failed to disable room #${id}: ${error.message}`);
      throw error;
    }
  }

  async enable(id: number) {
    try {
      await this.findOne(id); // throws 404 if room does not exist

      const room = await this.prisma.room.update({
        where: { id },
        data: { isActive: true },
      });

      this.logger.log(`Successfully enabled room ID: ${id}`);
      return room;
    } catch (error) {
      this.logger.error(`Failed to enable room #${id}: ${error.message}`);
      throw error;
    }
  }
  // FR-27, FR-28, FR-29: search available rooms by date range and optional capacity
  async searchAvailable(checkIn: string, checkOut: string, capacity?: number) {
    if (!checkIn || !checkOut) {
      this.logger.error('Search failed: checkIn and checkOut are required');
      throw new BadRequestException('checkIn and checkOut are required');
    }

    const start = new Date(checkIn);
    const end = new Date(checkOut);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      this.logger.error(`Search failed: invalid date format — checkIn: ${checkIn}, checkOut: ${checkOut}`);
      throw new BadRequestException(
        'Invalid date format. Use ISO 8601 (e.g. 2025-06-01T14:00:00Z)',
      );
    }

    if (start >= end) {
      this.logger.error(`Search failed: checkIn (${checkIn}) is not before checkOut (${checkOut})`);
      throw new BadRequestException('checkIn must be before checkOut');
    }

    // Find all room IDs that have a non-cancelled booking overlapping our window
    const conflicting = await this.prisma.booking.findMany({
      where: {
        status: { notIn: ['CANCELLED'] },
        AND: [
          { checkIn: { lt: end } },    // existing booking starts before our end
          { checkOut: { gt: start } }, // existing booking ends after our start
        ],
      },
      select: { roomId: true },
    });

    const bookedRoomIds = conflicting.map((b) => b.roomId);

    const available = await this.prisma.room.findMany({
      where: {
        isActive: true,
        id: { notIn: bookedRoomIds },
        ...(capacity ? { capacity: { gte: capacity } } : {}),
      },
    });

    this.logger.log(
      `Search complete — found ${available.length} available room(s) from ${checkIn} to ${checkOut}`,
    );

    return available;
  }
}