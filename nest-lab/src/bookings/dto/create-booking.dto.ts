export class CreateBookingDto {
  userId: number;
  roomId: number;
  checkIn: string;
  checkOut: string;
  status?: 'PENDING' | 'APPROVED' | 'CANCELLED' | 'PAID';
}