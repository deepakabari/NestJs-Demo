import * as bcrypt from 'bcryptjs';
import AppDataSource from '../../config/typeorm.config';
import { User } from '../../modules/users/entities/user.entity';

async function seed() {
  console.log('Initializing database connection...');
  await AppDataSource.initialize();

  const userRepository = AppDataSource.getRepository(User);
  const totalUsers = 20000;
  const batchSize = 1000; // Insert in chunks to avoid overwhelming MySQL

  console.log(`Starting to seed ${totalUsers} users...`);

  const default_password = await bcrypt.hash('password123', 10);

  for (let i = 0; i < totalUsers; i += batchSize) {
    const users: Partial<User>[] = [];

    for (let j = 0; j < batchSize; j++) {
      const index = i + j;
      users.push({
        email: `loaduser_${index}@example.com`,
        password: default_password,
        first_name: `Load`,
        last_name: `User${index}`,
      });
    }

    // Insert batch
    await userRepository.createQueryBuilder().insert().into(User).values(users).execute();

    console.log(`Inserted ${i + batchSize} / ${totalUsers} users...`);
  }

  console.log('Successfully inserted 20,000 users!');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Error seeding data:', error);
  process.exit(1);
});
