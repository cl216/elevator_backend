import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { AdminService } from './admin.service';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @Patch('users/:id/suspend')
  suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Patch('users/:id/unsuspend')
  unsuspendUser(@Param('id') id: string) {
    return this.adminService.unsuspendUser(id);
  }

  @Get('categories/pending')
  getPendingCategories() {
    return this.adminService.getPendingCategories();
  }

  @Patch('categories/:id/approve')
  approveCategory(@Param('id') id: string) {
    return this.adminService.approveCategory(id);
  }

  @Patch('categories/:id/reject')
  rejectCategory(@Param('id') id: string) {
    return this.adminService.rejectCategory(id);
  }

  @Get('bookings')
  getBookings() {
    return this.adminService.getBookings();
  }

  @Get('bookings/disputes')
  getDisputedBookings() {
    return this.adminService.getDisputedBookings();
  }

  @Patch('bookings/:id/approve-learner-no-show')
  approveLearnerNoShow(@Param('id') id: string) {
    return this.adminService.approveLearnerNoShow(id);
  }

  @Patch('bookings/:id/approve-teacher-no-show')
  approveTeacherNoShow(@Param('id') id: string) {
    return this.adminService.approveTeacherNoShow(id);
  }

  @Patch('bookings/:id/mark-completed')
  markBookingCompleted(@Param('id') id: string) {
    return this.adminService.markBookingCompleted(id);
  }

  @Patch('bookings/:id/reject-dispute')
  rejectDispute(@Param('id') id: string) {
    return this.adminService.rejectDispute(id);
  }

  @Get('sessions/pending')
  getPendingSessions() {
    return this.adminService.getPendingReviewSessions();
  }

  @Patch('sessions/:id/approve')
  approveSession(@Param('id') id: string) {
    return this.adminService.approveSession(id);
  }

  @Patch('sessions/:id/reject')
  rejectSession(@Param('id') id: string) {
    return this.adminService.rejectSession(id);
  }

  @Get('class-requests')
  getClassRequests() {
    return this.adminService.getClassRequests();
  }

  @Patch('class-requests/:id/approve')
  approveClassRequest(@Param('id') id: string) {
    return this.adminService.approveClassRequest(id);
  }

  @Patch('class-requests/:id/reject')
  rejectClassRequest(@Param('id') id: string) {
    return this.adminService.rejectClassRequest(id);
  }

  @Get('images')
  getModerationImages() {
    return this.adminService.getModerationImages();
  }

  @Patch('images/remove')
  removeModerationImage(
    @Body()
    body: {
      source_type: 'user' | 'teacher_profile' | 'class';
      source_id: string;
      field: string;
    },
  ) {
    return this.adminService.removeModerationImage(body);
  }
}