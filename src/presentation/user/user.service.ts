import { Injectable } from '@nestjs/common';
import { AuthIdentityService } from '../auth/auth-identity.service';
import { CognitoUserClaims } from '../auth/cognito-user.decorator';
import { UserRepository } from '../../domain/repositories/identity-auth/user.repository';
import { UserEntity } from '../../domain/entities/user.entity';
import { UserProfileResponseDto } from './dto/user-profile.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly authIdentityService: AuthIdentityService,
    private readonly userRepository: UserRepository,
  ) {}

  async getProfile(claims: CognitoUserClaims): Promise<UserProfileResponseDto> {
    const user = await this.authIdentityService.getUserBySub(claims);
    return this.toResponse(user);
  }

  async updateProfile(
    claims: CognitoUserClaims,
    data: { firstName: string; paternalLastName: string; dateOfBirth: string },
  ): Promise<UserProfileResponseDto> {
    const user = await this.authIdentityService.getUserBySub(claims);
    const updated = await this.userRepository.updateUserById(user.id, {
      firstName: data.firstName,
      paternalLastName: data.paternalLastName,
      dateOfBirth: new Date(data.dateOfBirth),
    });
    return this.toResponse(updated);
  }

  private toResponse(user: UserEntity): UserProfileResponseDto {
    return {
      firstName: user.firstName,
      paternalLastName: user.paternalLastName,
      dateOfBirth: user.dateOfBirth,
      email: user.email,
    };
  }
}
