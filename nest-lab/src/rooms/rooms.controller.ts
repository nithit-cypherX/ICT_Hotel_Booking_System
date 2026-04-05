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
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Controller('rooms')
export class RoomsController {
  private readonly logger = new Logger(RoomsController.name);

  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createRoomDto: CreateRoomDto) {
    this.logger.log(`Creating room: ${createRoomDto.name}`);
    return this.roomsService.create(createRoomDto);
  }

  // IMPORTANT: /search must be declared before /:id
  // otherwise NestJS treats the literal word "search" as an id param
  @Get('search')
  search(
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('capacity') capacity?: string,
  ) {
    this.logger.log(
      `Searching available rooms — checkIn: ${checkIn}, checkOut: ${checkOut}, capacity: ${capacity ?? 'any'}`,
    );
    return this.roomsService.searchAvailable(
      checkIn,
      checkOut,
      capacity ? +capacity : undefined,
    );
  }

  @Get()
  findAll() {
    this.logger.log('Fetching all active rooms');
    return this.roomsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Fetching details for room ID: ${id}`);
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoomDto: UpdateRoomDto,
  ) {
    this.logger.log(`Updating room ID: ${id}`);
    return this.roomsService.update(id, updateRoomDto);
  }

  // FR-10: soft deactivate — room stays in DB but disappears from public listing
  @Patch(':id/disable')
  disable(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Disabling room ID: ${id}`);
    return this.roomsService.disable(id);
  }

  @Patch(':id/enable')
  enable(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Enabling room ID: ${id}`);
    return this.roomsService.enable(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Deleting room ID: ${id}`);
    return this.roomsService.remove(id);
  }
}