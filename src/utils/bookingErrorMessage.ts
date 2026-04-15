export function normalizeBookingErrorMessage(message: string): string {
  switch (message) {
    case 'You already booked this session.':
      return 'You already booked this session.';

    case 'You already started booking this session. Complete payment to confirm it.':
      return 'You already started booking this session. Complete payment to confirm it.';

    case 'Your previous booking for this session was cancelled by the teacher, so it cannot be booked again.':
      return 'This session can’t be booked again because your previous booking was cancelled by the teacher.';

    case 'You already cancelled this session and it cannot be booked again.':
      return 'This session can’t be booked again because you already cancelled it.';

    case 'Your previous booking for this session has already been cancelled.':
      return 'This session can’t be booked again because your previous booking was already cancelled.';

    case 'Your previous booking attempt for this session expired and it cannot be booked again.':
      return 'This session can’t be booked again because your previous booking attempt expired.';

    case 'Session is fully booked':
      return 'This session is fully booked.';

    case 'You cannot book your own session':
      return 'You cannot book your own session.';

    case 'Session already started or is in the past':
      return 'This session has already started or is in the past.';

    default:
      return message;
  }
}