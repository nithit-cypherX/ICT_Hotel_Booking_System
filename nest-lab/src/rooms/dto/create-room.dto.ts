export class CreateRoomDto {
  name: string;
  description?: string;
  capacity: number;
  pricePerNight: number;
  imageUrl?: string;
  isActive?: boolean;
}