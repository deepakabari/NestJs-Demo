import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { UserRole } from 'src/constants/user-roles.enum';
import { CreateProductDto } from 'src/modules/products/dto/create-product.dto';
import { ProductsService } from 'src/modules/products/products.service';
import { CreateUserDto } from 'src/modules/users/dto/create-user.dto';
import { User } from 'src/modules/users/entities/user.entity';
import { UsersService } from 'src/modules/users/users.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const productsService = app.get(ProductsService);

  console.log('🌱 Seeding data...');

  const adminDto: CreateUserDto = {
    auth0Id: 'auth0|seed-admin-001',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    name: 'Admin User',
  };

  const userDto: CreateUserDto = {
    auth0Id: 'auth0|seed-user-001',
    email: 'user@example.com',
    role: UserRole.USER,
    name: 'Regular User',
  };

  let admin: User | null = null;
  let user: User | null = null;

  try {
    admin = await usersService.findByAuth0Id(adminDto.auth0Id);
    if (!admin) {
      console.log('➕ Creating admin user...');
      admin = await usersService.create(adminDto);
    } else {
      console.log('✅ Admin already exists.');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error creating/fetching admin:', message);
  }

  try {
    user = await usersService.findByAuth0Id(userDto.auth0Id);
    if (!user) {
      console.log('➕ Creating regular user...');
      user = await usersService.create(userDto);
    } else {
      console.log('✅ Regular user already exists.');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error creating/fetching user:', message);
  }

  if (!admin || !user) {
    console.error('❌ Seeding aborted due to user creation errors.');
    await app.close();
    return;
  }

  const productSeeds: { dto: CreateProductDto; owner: User }[] = [
    {
      dto: {
        name: 'Admin Product',
        description: 'Product created by admin',
        price: 999,
      },
      owner: admin,
    },
    {
      dto: {
        name: 'User Product',
        description: 'Product created by user',
        price: 499,
      },
      owner: user,
    },
  ];

  for (const { dto, owner } of productSeeds) {
    try {
      // Check if product already exists (optional based on logic)
      const existing = await productsService.findByName(dto.name); // Add findByName method if needed
      if (existing) {
        console.log(`✅ Product "${dto.name}" already exists.`);
        continue;
      }

      console.log(`➕ Creating product "${dto.name}"...`);
      await productsService.create(dto, owner); // Ensure method signature matches
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error creating product "${dto.name}":`, message);
    }
  }

  console.log('✅ Seeding complete.');
  await app.close();
}

void bootstrap();
