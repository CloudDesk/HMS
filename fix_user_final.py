import re
import sys

def modify_file():
    with open('apps/web/src/pages/UserManagementPage.tsx', 'r', encoding='utf-8') as f:
        code = f.read()

    # Imports
    code = code.replace(
        "import { useEffect, useMemo, useState, type FormEvent } from 'react';",
        "import { useEffect, useMemo, useState } from 'react';\nimport { useForm } from 'react-hook-form';\nimport { zodResolver } from '@hookform/resolvers/zod';\nimport { z } from 'zod';"
    )

    # PasswordInput Component
    old_pi = """function PasswordInput({
  autoComplete,
  invalid = false,
  onChange,
  onToggle,
  value,
  visible,
}: {
  autoComplete: 'current-password' | 'new-password';
  invalid?: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  value: string;
  visible: boolean;
}) {
  return (
    <div className="password-input">
      <input
        aria-invalid={invalid}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        required
        type={visible ? 'text' : 'password'}
        value={value}
      />"""
    
    new_pi = """import type React from 'react';

function PasswordInput({
  invalid = false,
  onToggle,
  visible,
  ...props
}: React.ComponentPropsWithoutRef<'input'> & {
  invalid?: boolean;
  onToggle: () => void;
  visible: boolean;
}) {
  return (
    <div className="password-input">
      <input
        aria-invalid={invalid}
        required
        type={visible ? 'text' : 'password'}
        {...props}
      />"""
    code = code.replace(old_pi, new_pi)

    # Schemas
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

    # Remove FormStates
    code = re.sub(r'type UserFormState = \{.*?status: UserStatus;\n};\n', '', code, flags=re.DOTALL)
    code = re.sub(r'type PasswordFormState = \{.*?};\n', '', code, flags=re.DOTALL)
    code = re.sub(r'const emptyUserForm: UserFormState = \{.*?};\n', '', code, flags=re.DOTALL)

    # Replace states
    state_replace = """  const userForm = useForm<UserFormData>({
    resolver: zodResolver(baseUserSchema),
    defaultValues: {
      employeeCode: '', username: '', email: '', fullName: '', phone: '', jobTitle: '',
      roleId: '', branchId: '', departmentId: '', password: '', confirmPassword: '', status: 'Active'
    }
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' }
  });"""
    code = re.sub(r'  const \[userForm, setUserForm\] = useState<UserFormState>\(emptyUserForm\);\n  const \[passwordForm, setPasswordForm\] = useState<PasswordFormState>\(\{ currentPassword: \'\', newPassword: \'\' \}\);\n  const \[fieldErrors, setFieldErrors\] = useState<Partial<Record<keyof UserFormState \| keyof PasswordFormState, string>>>\(\{\}\);\n', state_replace + '\n', code)

    # Remove updateForm and updatePasswordForm
    code = re.sub(r'  const updateForm = \(field: keyof UserFormState, value: string\) => \{.*?return next;\n    \}\);\n  };\n', '', code, flags=re.DOTALL)
    code = re.sub(r'  const updatePasswordForm = \(field: keyof PasswordFormState, value: string\) => \{.*?return next;\n    \}\);\n  };\n', '', code, flags=re.DOTALL)

    # Open Modal
    open_modal_replacement = """  const openModal = (mode: ModalMode, user?: UiUser) => {
    setModalMode(mode);
    setActiveUser(user ?? null);
    setFormError('');
    userForm.reset({
      employeeCode: user?.employeeCode ?? '',
      username: user?.username ?? '',
      email: user?.email ?? '',
      fullName: user?.fullName ?? '',
      phone: user?.phone ?? '',
      jobTitle: user?.jobTitle ?? '',
      roleId: user?.roleId ?? '',
      branchId: user?.branchId ?? '',
      departmentId: user?.departmentId ?? '',
      password: '',
      confirmPassword: '',
      status: (user?.status as any) ?? 'Active',
    });
    passwordForm.reset({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  };"""
    code = re.sub(r'  const openModal = \(mode: ModalMode, user\?: UiUser\) => \{.*?setModalMode\(mode\);\n  \};\n', open_modal_replacement + '\n', code, flags=re.DOTALL)

    # Handle Save Payload
    build_payload_replacement = """  const buildSavePayload = (data: UserFormData): SaveUserPayload => ({
    branches: branchOptions.filter(b => b.id === data.branchId).map(b => ({ id: b.id, name: b.name, isPrimary: true })),
    departments: departmentOptions.filter(d => d.id === data.departmentId).map(d => ({ id: d.id, name: d.name, isPrimary: true })),
    email: data.email || null,
    employeeCode: data.employeeCode || '',
    fullName: data.fullName,
    jobTitle: data.jobTitle || '',
    phone: data.phone || null,
    roleIds: [data.roleId],
    status: data.status.toLowerCase() as ApiUserStatus,
    username: data.username,
  });"""
    code = re.sub(r'  const buildSavePayload = \(\): SaveUserPayload => \(\{.*?\}\);\n', build_payload_replacement + '\n', code, flags=re.DOTALL)

    # Handlers
    handle_save_replacement = """  const handleSaveUser = async (data: UserFormData) => {
    if (submitting) return;
    setFormError('');

    if (modalMode === 'create') {
      if (!data.password) {
        userForm.setError('password', { message: 'Password is required for new users.' });
        return;
      }
      if (passwordPolicy) {
        const policyErrors = getPasswordPolicyErrors(data.password, passwordPolicy);
        if (policyErrors.length > 0) {
          userForm.setError('password', { message: `Password must ${policyErrors.join(' and ')}.` });
          return;
        }
      }
    }

    try {
      const payload = buildSavePayload(data);

      if (modalMode === 'create') {
        await mutations.createUser.mutateAsync({ ...payload, password: data.password });
        showToast('User created successfully.');
      } else if (modalMode === 'edit' && activeUser) {
        await mutations.updateUser.mutateAsync({ id: activeUser.apiId, payload });
        showToast('User updated successfully.');
      } else if (modalMode === 'assign-role' && activeUser) {
        await mutations.updateUser.mutateAsync({ id: activeUser.apiId, payload });
        showToast('Role updated successfully.');
      }
      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const handlePasswordReset = async (data: PasswordFormData) => {
    if (submitting || !activeUser) return;
    setFormError('');
    if (passwordPolicy) {
      const policyErrors = getPasswordPolicyErrors(data.newPassword, passwordPolicy);
      if (policyErrors.length > 0) {
        passwordForm.setError('newPassword', { message: `Password must ${policyErrors.join(' and ')}.` });
        return;
      }
    }
    try {
      if (modalMode === 'change-password') {
        await mutations.changePassword.mutateAsync({ 
          currentPassword: data.currentPassword!, 
          newPassword: data.newPassword 
        });
        showToast('Password changed successfully.');
      } else if (modalMode === 'reset-password') {
        await mutations.adminResetPassword.mutateAsync({ 
          id: activeUser.apiId, 
          newPassword: data.newPassword 
        });
        showToast('User password has been reset.');
      }
      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };"""

    code = re.sub(r'  const validateUserForm = \(\) => \{.*?\n  \};\n', handle_save_replacement + '\n', code, flags=re.DOTALL)
    code = re.sub(r'  const handleSaveUser = async \(event: FormEvent\) => \{.*?catch \(error\) \{\n      setFormError\(getErrorMessage\(error\)\);\n    \}\n  \};\n', '', code, flags=re.DOTALL)
    code = re.sub(r'  const handlePasswordReset = async \(event: FormEvent\) => \{.*?catch \(error\) \{\n      setFormError\(getErrorMessage\(error\)\);\n    \}\n  \};\n', '', code, flags=re.DOTALL)

    # JSX Replacements
    code = code.replace("<form onSubmit={handleSaveUser}>", "<form onSubmit={userForm.handleSubmit(handleSaveUser)}>")
    code = code.replace("<form onSubmit={handlePasswordReset}>", "<form onSubmit={passwordForm.handleSubmit(handlePasswordReset)}>")

    def repl_text(m):
        field = m.group(1)
        return f"{{...userForm.register('{field}')}}"
    
    code = re.sub(r'onChange=\{\(event\) => updateForm\(\'([a-zA-Z0-9_]+)\', event\.target\.value\)\} (?:required )?(?:type="email" )?value=\{userForm\.[a-zA-Z0-9_]+\}', repl_text, code)
    code = re.sub(r'onChange=\{\(event\) => updateForm\(\'([a-zA-Z0-9_]+)\', event\.target\.value\)\} value=\{userForm\.[a-zA-Z0-9_]+\}', repl_text, code)

    def repl_pw(m):
        field = m.group(1)
        return f"{{...userForm.register('{field}')}}"
    code = re.sub(r'onChange=\{\(value\) => updateForm\(\'([a-zA-Z0-9_]+)\', value\)\}\n\s*onToggle', lambda m: f"{{...userForm.register('{m.group(1)}')}}\n                      onToggle", code)
    code = re.sub(r'value=\{userForm\.(password|confirmPassword)\}', '', code)

    def repl_pw_reset(m):
        field = m.group(1)
        return f"{{...passwordForm.register('{field}')}}"
    code = re.sub(r'onChange=\{\(value\) => updatePasswordForm\(\'([a-zA-Z0-9_]+)\', value\)\}\n\s*onToggle', lambda m: f"{{...passwordForm.register('{m.group(1)}')}}\n                      onToggle", code)
    code = re.sub(r'value=\{passwordForm\.(currentPassword|newPassword|confirmNewPassword)\}', '', code)

    # fieldErrors replacements
    code = re.sub(r'fieldErrors\.([a-zA-Z0-9_]+)', r'userForm.formState.errors.\1?.message', code)
    code = re.sub(r'userForm\.formState\.errors\.(currentPassword|newPassword|confirmNewPassword)\?\.message', r'passwordForm.formState.errors.\1?.message', code)

    # aria-invalid replacements
    code = re.sub(r'aria-invalid=\{Boolean\(userForm\.formState\.errors\.([a-zA-Z0-9_]+)\?\.message\)\}', r'aria-invalid={Boolean(userForm.formState.errors.\1)}', code)
    code = re.sub(r'aria-invalid=\{Boolean\(passwordForm\.formState\.errors\.([a-zA-Z0-9_]+)\?\.message\)\}', r'aria-invalid={Boolean(passwordForm.formState.errors.\1)}', code)

    with open('apps/web/src/pages/UserManagementPage.tsx', 'w', encoding='utf-8') as f:
        f.write(code)

if __name__ == '__main__':
    modify_file()
