import * as React from 'react';
import { render } from '@react-email/render';
import { BookingConfirmedEmail } from './templates/booking-confirmed.email';

async function main() {
  const html = await render(
    <BookingConfirmedEmail
      learnerFirstName="Sarah"
      sessionTitle="Beginner Piano"
      teacherName="Emma Walsh"
      startAt="Tue 24 Mar, 18:00"
      locationText="Ranelagh, Dublin"
      bookingUrl="http://localhost:3000/bookings/test-booking-id"
    />,
  );

  console.log(html);
}

main();