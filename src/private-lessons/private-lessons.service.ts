import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  PrivateSessionRequest,
  PrivateSessionRequestStatus,
} from './entities/private-lesson-request.entity';
import { TeacherProfile } from '../teacher/entities/teacher-profile.entity';
import { SessionsService } from '../sessions/sessions.service';
import { Notification } from '../notifications/entities/notification.entity';

type CreatePrivateSessionRequestInput = {
  learnerId: string;
  teacherId: string;
  message: string;
  requestedDate1?: string | null;
  requestedDate2?: string | null;
  requestedDate3?: string | null;
  requestedDurationMinutes?: number | null;
  learnerNote?: string | null;
};

type AcceptPrivateSessionRequestInput = {
  requestId: string;
  teacherId: string;
  title: string;
  description?: string | null;
  category: string;
  price: number;
  startTime: string;
  duration: number;
  lat: number;
  lng: number;
  roughLocation: string;
  arrivalInstructions?: string | null;
};

@Injectable()
export class PrivateSessionRequestsService {
  constructor(
    @InjectRepository(PrivateSessionRequest)
    private readonly privateSessionRequestsRepo: Repository<PrivateSessionRequest>,

    @InjectRepository(Notification)
private readonly notificationsRepo: Repository<Notification>,

    @InjectRepository(TeacherProfile)
    private readonly teacherProfilesRepo: Repository<TeacherProfile>,

    @Inject(forwardRef(() => SessionsService))
    private readonly sessionsService: SessionsService,
  ) {}

  async createRequest(input: CreatePrivateSessionRequestInput) {
    if (!input.message?.trim()) {
      throw new BadRequestException('Message is required.');
    }

    if (input.learnerId === input.teacherId) {
      throw new BadRequestException(
        'You cannot request a private session with yourself.',
      );
    }

    const teacherProfile = await this.teacherProfilesRepo.findOne({
      where: {
        user: { id: input.teacherId } as any,
      },
      relations: ['user'],
    });

    if (!teacherProfile) {
      throw new NotFoundException('Teacher profile not found.');
    }

    const requestedDates = [
      input.requestedDate1 ? new Date(input.requestedDate1) : null,
      input.requestedDate2 ? new Date(input.requestedDate2) : null,
      input.requestedDate3 ? new Date(input.requestedDate3) : null,
    ];

    for (const dt of requestedDates) {
      if (!dt) continue;

      if (Number.isNaN(dt.getTime())) {
        throw new BadRequestException('One of the requested dates is invalid.');
      }

      if (dt.getTime() <= Date.now()) {
        throw new BadRequestException('Requested dates must be in the future.');
      }
    }

    const request = this.privateSessionRequestsRepo.create({
      learner: { id: input.learnerId } as any,
      teacher: { id: input.teacherId } as any,
      message: input.message.trim(),
      requested_date_1: requestedDates[0],
      requested_date_2: requestedDates[1],
      requested_date_3: requestedDates[2],
      requested_duration_minutes: input.requestedDurationMinutes ?? null,
      learner_note: input.learnerNote?.trim() || null,
      status: PrivateSessionRequestStatus.OPEN,
    });

const savedRequest = await this.privateSessionRequestsRepo.save(request);

await this.notificationsRepo.save(
  this.notificationsRepo.create({
    user_id: input.teacherId,
    type: 'private_session_request_created',
    title: 'New private session request',
    body: 'A learner sent you a private 1:1 request.',
    payload: {
      private_session_request_id: savedRequest.id,
      learner_id: input.learnerId,
    },
  }),
);

return savedRequest;  }

  async getMyLearnerRequests(learnerId: string) {
    return this.privateSessionRequestsRepo.find({
      where: {
        learner: { id: learnerId } as any,
      },
      relations: ['teacher'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async getMyTeacherRequests(teacherId: string) {
    return this.privateSessionRequestsRepo.find({
      where: {
        teacher: { id: teacherId } as any,
      },
      relations: ['learner'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async cancelRequest(requestId: string, learnerId: string) {
    const request = await this.privateSessionRequestsRepo.findOne({
      where: { id: requestId },
      relations: ['learner', 'teacher'],
    });

    if (!request) {
      throw new NotFoundException('Private session request not found.');
    }

    if (request.learner.id !== learnerId) {
      throw new ForbiddenException('You cannot cancel this request.');
    }

    if (request.status !== PrivateSessionRequestStatus.OPEN) {
      throw new BadRequestException('Only open requests can be cancelled.');
    }

    request.status = PrivateSessionRequestStatus.CANCELLED;
    request.cancelled_at = new Date();

    return this.privateSessionRequestsRepo.save(request);
  }

  async declineRequest(
    requestId: string,
    teacherId: string,
    teacherResponseMessage?: string | null,
  ) {
    const request = await this.privateSessionRequestsRepo.findOne({
      where: { id: requestId },
relations: ['teacher', 'learner'],    });

    if (!request) {
      throw new NotFoundException('Private session request not found.');
    }

    if (request.teacher.id !== teacherId) {
      throw new ForbiddenException('You cannot decline this request.');
    }

    if (request.status !== PrivateSessionRequestStatus.OPEN) {
      throw new BadRequestException('Only open requests can be declined.');
    }

    const trimmedMessage = teacherResponseMessage?.trim() || null;

    if (trimmedMessage && trimmedMessage.length > 500) {
      throw new BadRequestException(
        'Decline message must be 500 characters or fewer.',
      );
    }

    request.status = PrivateSessionRequestStatus.DECLINED;
    request.declined_at = new Date();
    request.teacher_response_message = trimmedMessage;

const savedRequest = await this.privateSessionRequestsRepo.save(request);

await this.notificationsRepo.save(
  this.notificationsRepo.create({
    user_id: savedRequest.learner.id,
    type: 'private_session_request_declined',
    title: 'Private request declined',
    body: trimmedMessage
      ? 'Your private session request was declined with a message from the teacher.'
      : 'Your private session request was declined.',
    payload: {
      private_session_request_id: savedRequest.id,
      teacher_response_message: savedRequest.teacher_response_message,
    },
  }),
);

return savedRequest;
  }

  async acceptRequest(input: AcceptPrivateSessionRequestInput) {
    const request = await this.privateSessionRequestsRepo.findOne({
      where: { id: input.requestId },
      relations: ['teacher', 'learner'],
    });

    if (!request) {
      throw new NotFoundException('Private session request not found.');
    }

    if (request.teacher.id !== input.teacherId) {
      throw new ForbiddenException('You cannot accept this request.');
    }

    if (request.status !== PrivateSessionRequestStatus.OPEN) {
      throw new BadRequestException('Only open requests can be accepted.');
    }

    if (!input.title?.trim()) {
      throw new BadRequestException('Title is required.');
    }

    if (!input.category?.trim()) {
      throw new BadRequestException('Category is required.');
    }

    if (!Number.isFinite(input.price) || input.price <= 0) {
      throw new BadRequestException('Price must be greater than 0.');
    }

    if (!Number.isFinite(input.duration) || input.duration <= 0) {
      throw new BadRequestException('Duration must be greater than 0.');
    }

    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
      throw new BadRequestException('Valid coordinates are required.');
    }

    if (!input.roughLocation?.trim()) {
      throw new BadRequestException('Rough location is required.');
    }

    const startTime = new Date(input.startTime);
    if (
      Number.isNaN(startTime.getTime()) ||
      startTime.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Start time must be a valid future date.');
    }

    const savedSession = await this.sessionsService.createAcceptedPrivateSession({
      teacherId: input.teacherId,
      privateRequest: request,
      title: input.title.trim(),
      category: input.category.trim(),
      description: input.description?.trim() || null,
      price: input.price,
      start_time: input.startTime,
      duration: input.duration,
      lat: input.lat,
      lng: input.lng,
      rough_location: input.roughLocation.trim(),
      arrival_instructions: input.arrivalInstructions?.trim() || null,
    });

    //request.teacher_response_message = null;


request.status = PrivateSessionRequestStatus.ACCEPTED;
request.accepted_at = new Date();
request.accepted_session_id = savedSession.id;

const savedRequest = await this.privateSessionRequestsRepo.save(request);

await this.notificationsRepo.save(
  this.notificationsRepo.create({
    user_id: savedRequest.learner.id,
    type: 'private_session_request_accepted',
    title: 'Private request accepted',
    body: 'Your teacher created a private session for you to book.',
    payload: {
      private_session_request_id: savedRequest.id,
      session_id: savedSession.id,
    },
  }),
);

return savedSession;  }
}