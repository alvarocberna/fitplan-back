import { Injectable } from '@nestjs/common';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../current-user.resolver';
import { ProfileDto, toProfileDto } from '../dto/profile.dto';

// CU-IDN-02.
@Injectable()
export class GetMyProfileUseCase {
  constructor(private readonly currentUser: CurrentUserResolver) {}

  async execute(input: { claims: CognitoUserClaims }): Promise<ProfileDto> {
    const user = await this.currentUser.resolve(input.claims);
    return toProfileDto(user, this.currentUser.isProfileComplete(user));
  }
}
