import { Injectable } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createBookingDto: CreateBookingDto) {
    return this.prisma.booking.create({
      data: {
        ...createBookingDto,
        checkIn: new Date(createBookingDto.checkIn),
        checkOut: new Date(createBookingDto.checkOut),
      },
    });
  }

  findAll() {
    return this.prisma.booking.findMany({
      include: { user: true, room: true }, // This fetches the related user and room data
    });
  }

  findOne(id: number) {
    return this.prisma.booking.findUnique({
      where: { id },
      include: { user: true, room: true },
    });
  }

  update(id: number, updateBookingDto: UpdateBookingDto) {
    // If dates are provided in the update, convert them
    const dataToUpdate: any = { ...updateBookingDto };
    if (updateBookingDto.checkIn) {
      dataToUpdate.checkIn = new Date(updateBookingDto.checkIn);
    }
    if (updateBookingDto.checkOut) {
      dataToUpdate.checkOut = new Date(updateBookingDto.checkOut);
    }

    return this.prisma.booking.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  remove(id: number) {
    return this.prisma.booking.delete({
      where: { id },
    });
  }
}