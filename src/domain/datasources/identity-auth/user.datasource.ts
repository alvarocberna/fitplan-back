import { UserEntity } from '../../entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  FindOrCreateUserByEmailDto,
} from '../..';

export abstract class UserDatasource {
  abstract createUser(createUserDto: CreateUserDto): Promise<UserEntity>;
  abstract getUserById(id: string): Promise<UserEntity | null>;
  abstract updateUserById(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserEntity>;
  abstract deleteUserById(id: string): Promise<void>;

  // Busca un User por email; si no existe, lo crea con los datos dados. No hay flujo de
  // login/registro real hoy — esto es lo que usa OrdersService.createOrder para resolver el
  // userId de la nueva Order a partir de personalInfo.email.
  abstract findOrCreateUserByEmail(
    dto: FindOrCreateUserByEmailDto,
  ): Promise<UserEntity>;
}
