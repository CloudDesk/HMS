import re

with open('apps/web/src/pages/UserManagementPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace React imports
code = code.replace(
    "import { useEffect, useMemo, useState, type FormEvent } from 'react';",
    "import { useEffect, useMemo, useState } from 'react';\nimport { useForm } from 'react-hook-form';\nimport { zodResolver } from '@hookform/resolvers/zod';\nimport { z } from 'zod';"
)

# Insert schemas
schemas = """
const baseUserSchema = z.object({
  employeeCode: z.string().optional(),
  username: z.string().min(1, 'Username is required.'),
  email: z.string().email('Valid email is required.').min(1, 'Email is required.'),
  fullName: z.string().min(1, 'Full name is required.'),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  roleId: z.string().min(1, 'Role assignment is required.'),
  branchId: z.string().min(1, 'Branch assignment is required.'),
  departmentId: z.string().min(1, 'Department assignment is required.'),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  status: z.enum(['Active', 'Inactive', 'Locked']).default('Active')
});

export type UserFormData = z.infer<typeof baseUserSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(1, 'New password is required.'),
  confirmNewPassword: z.string().min(1, 'Please confirm your new password.'),
}).superRefine((data, ctx) => {
  if (data.newPassword !== data.confirmNewPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords must match.",
      path: ["confirmNewPassword"]
    });
  }
});
export type PasswordFormData = z.infer<typeof passwordSchema>;
"""
code = code.replace("type UiUser = {", schemas + "\n\ntype UiUser = {")

# Remove old FormState types
code = re.sub(r'type UserFormState = \{.*?status: UserStatus;\n};\n', '', code, flags=re.DOTALL)
code = re.sub(r'type PasswordFormState = \{.*?};\n', '', code, flags=re.DOTALL)
code = re.sub(r'const emptyUserForm: UserFormState = \{.*?};\n', '', code, flags=re.DOTALL)

with open('apps/web/src/pages/UserManagementPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)