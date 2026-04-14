import { PartialType } from '@nestjs/swagger';
import { CreateRoomDto } from './create-room.dto';

// PartialType from @nestjs/swagger — preserves @ApiProperty decorators in Swagger UI
// All fields become optional and validators still run on any field that is provided
export class UpdateRoomDto extends PartialType(CreateRoomDto) {}
