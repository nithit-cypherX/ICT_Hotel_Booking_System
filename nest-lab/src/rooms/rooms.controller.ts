import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('rooms')
export class RoomsController {
  private readonly logger = new Logger(RoomsController.name);

  constructor(private readonly roomsService: RoomsService) {}

  // FR-8: admin only — create a new room
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() createRoomDto: CreateRoomDto) {
    this.logger.log(`Admin is creating a new room: ${createRoomDto.name}`);
    return this.roomsService.create(createRoomDto);
  }

  // IMPORTANT: /search must be declared before /:id
  // otherwise NestJS treats the literal word "search" as an id param

  // FR-27, FR-28, FR-29: public — guests can search available rooms
  @Get('search')
  search(
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('capacity') capacity?: string,
  ) {
    this.logger.log(
      `Room search requested — checkIn: ${checkIn}, checkOut: ${checkOut}, capacity: ${capacity ?? 'any'}`,
    );
    return this.roomsService.searchAvailable(
      checkIn,
      checkOut,
      capacity ? +capacity : undefined,
    );
  }

  // FR-12: public — guests can view the list of active rooms
  @Get()
  findAll() {
    this.logger.log('Fetching all active rooms');
    return this.roomsService.findAll();
  }

  // FR-13: public — guests can view a specific room's details
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Fetching details for room ID: ${id}`);
    return this.roomsService.findOne(id);
  }

  // FR-9: admin only — update room details
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoomDto: UpdateRoomDto,
  ) {
    this.logger.log(`Admin is updating room ID: ${id}`);
    return this.roomsService.update(id, updateRoomDto);
  }

  // FR-10: admin only — soft deactivate a room (hides from public listing)
  @Patch(':id/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  disable(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Admin is disabling room ID: ${id}`);
    return this.roomsService.disable(id);
  }

  // FR-10: admin only — re-activate a previously disabled room
  @Patch(':id/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  enable(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Admin is enabling room ID: ${id}`);
    return this.roomsService.enable(id);
  }

  // FR-10: admin only — hard delete a room
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Admin is deleting room ID: ${id}`);
    return this.roomsService.remove(id);
  }
}
