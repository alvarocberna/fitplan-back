import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CognitoUser } from '../auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../auth/cognito-user.decorator';
import {
  UpdateUserProfileDtoImpl,
  UserProfileResponseDto,
} from './dto/user-profile.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(CognitoAuthGuard)
  @Get('me')
  getMe(
    @CognitoUser() cognitoUser: CognitoUserClaims,
  ): Promise<UserProfileResponseDto> {
    return this.userService.getProfile(cognitoUser);
  }

  @UseGuards(CognitoAuthGuard)
  @Patch('me')
  updateMe(
    @Body() body: UpdateUserProfileDtoImpl,
    @CognitoUser() cognitoUser: CognitoUserClaims,
  ): Promise<UserProfileResponseDto> {
    return this.userService.updateProfile(cognitoUser, body);
  }
}
