import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const doctor = await prisma.doctor.findFirst({
    where: { first_name: { contains: 'Kamesh', mode: 'insensitive' } }
  });

  if (!doctor) {
    console.log("Doctor Kamesh not found.");
    return;
  }

  console.log("Found doctor:", doctor.first_name, doctor.last_name);

  // Get the DOCTOR role
  const doctorRole = await prisma.role.findUnique({
    where: { code: 'DOCTOR' }
  });

  if (!doctorRole) {
    console.log("DOCTOR role not found.");
    return;
  }

  // Check if user already exists
  let user = await prisma.user.findUnique({
    where: { username: 'kamesh' }
  });

  if (!user) {
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    user = await prisma.user.create({
      data: {
        username: 'kamesh',
        email: doctor.email || 'kamesh@example.com',
        full_name: `${doctor.first_name} ${doctor.last_name}`,
        password_hash: hashedPassword,
        status: 'active',
        employee_code: 'EMP-' + doctor.doctor_number,
        user_roles: {
          create: {
            role_id: doctorRole.id
          }
        }
      }
    });
    console.log("Created user Kamesh with username 'kamesh' and password 'Password123!'");
  } else {
    console.log("User kamesh already exists.");
  }

  // Link user to doctor
  await prisma.doctor.update({
    where: { id: doctor.id },
    data: { user_id: user.id }
  });

  console.log("Successfully linked user to doctor Kamesh.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
