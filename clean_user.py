import re

with open('apps/web/src/pages/UserManagementPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Imports
code = code.replace(
    "import { useEffect, useMemo, useState, type FormEvent } from 'react';",
    "import { useEffect, useMemo, useState } from 'react';\nimport { useForm } from 'react-hook-form';\nimport { zodResolver } from '@hookform/resolvers/zod';\nimport { z } from 'zod';"
)

# 2. Schemas
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
}).superRefine((data, ctx) => {
  // policy validation done dynamically
});
export type PasswordFormData = z.infer<typeof passwordSchema>;
"""
code = code.replace("type UiUser = {", schemas + "\ntype UiUser = {")

# 3. FormStates
code = re.sub(r'type UserFormState = \{.*?status: UserStatus;\n};\n', '', code, flags=re.DOTALL)
code = re.sub(r'type PasswordFormState = \{.*?};\n', '', code, flags=re.DOTALL)
code = re.sub(r'const emptyUserForm: UserFormState = \{.*?};\n', '', code, flags=re.DOTALL)

# 4. PasswordInput
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
}) {"""
new_pi = """import type React from 'react';

const PasswordInput = React.forwardRef<HTMLInputElement, {
  autoComplete: 'current-password' | 'new-password';
  invalid?: boolean;
  onToggle: () => void;
  visible: boolean;
} & React.ComponentPropsWithoutRef<'input'>>(({
  autoComplete,
  invalid = false,
  onToggle,
  visible,
  ...props
}, ref) => {"""
code = code.replace(old_pi, new_pi)
code = code.replace(
    """      <input
        aria-invalid={invalid}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        required
        type={visible ? 'text' : 'password'}
        value={value}
      />""",
    """      <input
        aria-invalid={invalid}
        autoComplete={autoComplete}
        required
        type={visible ? 'text' : 'password'}
        ref={ref}
        {...props}
      />"""
)
code = code.replace(
    """        <button
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="password-input__toggle"
          onClick={onToggle}
          title={visible ? 'Hide password' : 'Show password'}
          type="button"
        >""",
    """        <button
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="password-input__toggle"
          onClick={onToggle}
          title={visible ? 'Hide password' : 'Show password'}
          type="button"
        >"""
)
code = re.sub(r'function PasswordInput.*?return \(\n', lambda m: m.group(0), code, flags=re.DOTALL)
code = code.replace("        </button>\n      </div>\n    );\n  }\n", "        </button>\n      </div>\n    );\n  });\n")

# 5. State Initialization
state_replace = """  const userForm = useForm<UserFormData>({
    resolver: zodResolver(baseUserSchema),
    defaultValues: {
      employeeCode: '', username: '', email: '', fullName: '', phone: '', jobTitle: '',
      roleId: '', branchId: '', departmentId: '', password: '', confirmPassword: '', status: 'Active'
    }
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '' }
  });"""
code = re.sub(r'  const \[userForm, setUserForm\] = useState<UserFormState>\(emptyUserForm\);\n  const \[passwordForm, setPasswordForm\] = useState<PasswordFormState>\(\{ currentPassword: \'\', newPassword: \'\' \}\);\n  const \[fieldErrors, setFieldErrors\] = useState<Partial<Record<keyof UserFormState \| keyof PasswordFormState, string>>>\(\{\}\);\n', state_replace + '\n', code)

# 6. Remove update helpers
code = re.sub(r'  const updateForm = \(field: keyof UserFormState, value: string\) => \{.*?return next;\n    \}\);\n  };\n', '', code, flags=re.DOTALL)
code = re.sub(r'  const updatePasswordForm = \(field: keyof PasswordFormState, value: string\) => \{.*?return next;\n    \}\);\n  };\n', '', code, flags=re.DOTALL)

# 7. openModal & closeModal
code = code.replace("setUserForm(emptyUserForm);", """userForm.reset({ employeeCode: '', username: '', email: '', fullName: '', phone: '', jobTitle: 'Doctor', roleId: '', branchId: '', departmentId: '', password: '', confirmPassword: '', status: 'Active' }); passwordForm.reset();""")
code = code.replace("setPasswordForm({ currentPassword: '', newPassword: '' });", "passwordForm.reset();")
code = code.replace("setFieldErrors({});", "")

code = re.sub(
r"""    if \(user\) \{
      setUserForm\(\{
        branchId: user\.branchId,
        confirmPassword: '',
        departmentId: user\.departmentId,
        email: user\.email,
        employeeCode: user\.source\.employeeCode \?\? '',
        fullName: user\.fullName,
        jobTitle: user\.source\.jobTitle \?\? '',
        password: '',
        phone: user\.phone,
        roleId: user\.roleId,
        status: user\.status,
        username: user\.username,
      \}\);
    \}""",
"""    if (user) {
      userForm.reset({
        branchId: user.branchId,
        confirmPassword: '',
        departmentId: user.departmentId,
        email: user.email,
        employeeCode: user.source.employeeCode ?? '',
        fullName: user.fullName,
        jobTitle: user.source.jobTitle ?? '',
        password: '',
        phone: user.phone,
        roleId: user.roleId,
        status: user.status as any,
        username: user.username,
      });
    }""", code, flags=re.DOTALL)

# 8. Handlers
code = re.sub(r'  const validateUserForm = \(\) => \{.*?\n  };\n', '', code, flags=re.DOTALL)
code = re.sub(r'  const buildSavePayload = \(\): SaveUserPayload => \(\{.*?\}\);\n', '', code, flags=re.DOTALL)

handle_save_user = """  const buildSavePayload = (data: UserFormData): SaveUserPayload => ({
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
  });

  const handleSaveUser = async (data: UserFormData) => {
    if (submitting) return;
    setFormError('');

    if (modalMode === 'create') {
      if (!data.password) {
        userForm.setError('password', { message: 'Password is required for new users.' });
        return;
      }
      if (data.password !== data.confirmPassword) {
        userForm.setError('confirmPassword', { message: 'Passwords must match.' });
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
  };"""
code = re.sub(r'  const handleSaveUser = async \(event: FormEvent\) => \{.*?catch \(error\) \{\n      setFormError\(getErrorMessage\(error\)\);\n    \}\n  };\n', handle_save_user + '\n', code, flags=re.DOTALL)

handle_pw_submit = """  const handlePasswordSubmit = async (data: PasswordFormData) => {
    if (!activeUser || submitting) return;
    setFormError('');
    if (passwordPolicy) {
      const policyErrors = getPasswordPolicyErrors(data.newPassword, passwordPolicy);
      if (policyErrors.length > 0) {
        passwordForm.setError('newPassword', { message: `Password must ${policyErrors.join(' and ')}.` });
        return;
      }
    }
    try {
      if (modalMode === 'reset-password') {
        await mutations.resetPassword.mutateAsync({ id: activeUser.apiId, newPassword: data.newPassword });
        showToast('Password reset successfully.');
      } else if (modalMode === 'change-password') {
        // ...
      }
      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };"""
code = re.sub(r'  const handlePasswordSubmit = async \(event: FormEvent\) => \{.*?catch \(error\) \{\n      setFormError\(getErrorMessage\(error\)\);\n    \}\n  };\n', handle_pw_submit + '\n', code, flags=re.DOTALL)

# 9. JSX Forms
code = code.replace('<form id="user-management-modal-form" onSubmit={(event) => void handleSaveUser(event)}>', '<form id="user-management-modal-form" onSubmit={(event) => { event.stopPropagation(); void userForm.handleSubmit(handleSaveUser)(event); }}>')
code = code.replace('<form id="user-management-modal-form" onSubmit={(event) => void handlePasswordSubmit(event)}>', '<form id="user-management-modal-form" onSubmit={(event) => { event.stopPropagation(); void passwordForm.handleSubmit(handlePasswordSubmit)(event); }}>')

# Regex inputs replacement
def repl(m):
    return f"{{...userForm.register('{m.group(1)}')}}"
code = re.sub(r'onChange=\{\(event\) => updateForm\(\'([a-zA-Z0-9_]+)\', event\.target\.value\)\} (?:required )?(?:type="email" )?value=\{userForm\.[a-zA-Z0-9_]+\}', repl, code)
code = re.sub(r'onChange=\{\(event\) => updateForm\(\'([a-zA-Z0-9_]+)\', event\.target\.value\)\} value=\{userForm\.[a-zA-Z0-9_]+\}', repl, code)
code = re.sub(r'onChange=\{\(event\) => updateForm\(\'([a-zA-Z0-9_]+)\', event\.target\.value\)\} required value=\{userForm\.[a-zA-Z0-9_]+\}', repl, code)

# Passwords
code = re.sub(r'onChange=\{\(value\) => updateForm\(\'([a-zA-Z0-9_]+)\', value\)\}\n\s*onToggle', lambda m: f"{{...userForm.register('{m.group(1)}')}}\n                      onToggle", code)
code = re.sub(r'value=\{userForm\.(password|confirmPassword)\}', '', code)

code = re.sub(r'onChange=\{\(value\) => updatePasswordForm\(\'([a-zA-Z0-9_]+)\', value\)\}\n\s*onToggle', lambda m: f"{{...passwordForm.register('{m.group(1)}')}}\n                      onToggle", code)
code = re.sub(r'value=\{passwordForm\.(currentPassword|newPassword|confirmNewPassword)\}', '', code)

# errors
code = re.sub(r'fieldErrors\.([a-zA-Z0-9_]+)', r'userForm.formState.errors.\1?.message', code)
code = re.sub(r'userForm\.formState\.errors\.(currentPassword|newPassword|confirmNewPassword)\?\.message', r'passwordForm.formState.errors.\1?.message', code)
code = re.sub(r'aria-invalid=\{Boolean\(userForm\.formState\.errors\.([a-zA-Z0-9_]+)\?\.message\)\}', r'aria-invalid={Boolean(userForm.formState.errors.\1)}', code)
code = re.sub(r'aria-invalid=\{Boolean\(passwordForm\.formState\.errors\.([a-zA-Z0-9_]+)\?\.message\)\}', r'aria-invalid={Boolean(passwordForm.formState.errors.\1)}', code)

with open('apps/web/src/pages/UserManagementPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
