import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from '../../../domain';
import { UserRepository } from '../../../domain/repositories/identity-auth/user.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../current-user.resolver';
import {
  ProfileDto,
  toProfileDto,
  UpdateProfileDtoImpl,
} from '../dto/profile.dto';

// CU-IDN-03. Unifica los antiguos PATCH /auth/perfil y PATCH /user/me: solo se actualizan los
// campos que vienen en el body (un campo ausente conserva su valor; uno en null lo limpia).
@Injectable()
export class UpdateMyProfileUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
    data: UpdateProfileDtoImpl;
  }): Promise<ProfileDto> {
    const user = await this.currentUser.resolve(input.claims);
    const updated = await this.userRepository.updateUserById(
      user.id,
      toUpdateUserDto(input.data),
    );
    return toProfileDto(updated, this.currentUser.isProfileComplete(updated));
  }
}

function toUpdateUserDto(data: UpdateProfileDtoImpl): UpdateUserDto {
  const { dateOfBirth, ...rest } = data;
  const update: UpdateUserDto = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );
  if (dateOfBirth !== undefined) update.dateOfBirth = new Date(dateOfBirth);
  return update;
}
