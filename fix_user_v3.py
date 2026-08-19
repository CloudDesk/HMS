import re

def fix():
    with open('apps/web/src/pages/UserManagementPage.tsx', 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. Imports
    code = code.replace(
        "import { useEffect, useMemo, useState, type FormEvent } from 'react';",
        "import React, { useEffect, useMemo, useState } from 'react';\nimport { useForm } from 'react-hook-form';\nimport { zodResolver } from '@hookform/resolvers/zod';\nimport { z } from 'zod';"
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
  status: z.enum(['Active', 'Inactive', 'Locked'])
});

export type UserFormData = z.infer<typeof baseUserSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(1, 'New password is required.'),
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
      />
      <button
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="password-input__toggle"
        onClick={onToggle}
        title={visible ? 'Hide password' : 'Show password'}
        type="button"
      >
        <i className={`ph ${visible ? 'ph-eye-slash' : 'ph-eye'}`} aria-hidden="true" />
      </button>
    </div>
  );
}"""
    new_pi = """const PasswordInput = React.forwardRef<HTMLInputElement, {
  autoComplete: 'current-password' | 'new-password';
  invalid?: boolean;
  onToggle: () => void;
  visible: boolean;
} & Omit<React.ComponentPropsWithoutRef<'input'>, 'onChange'> & { onChange?: React.ChangeEventHandler<HTMLInputElement> }>(({
  autoComplete,
  invalid = false,
  onToggle,
  visible,
  ...props
}, ref) => {
  return (
    <div className="password-input">
      <input
        aria-invalid={invalid}
        autoComplete={autoComplete}
        required
        type={visible ? 'text' : 'password'}
        ref={ref}
        {...props}
      />
      <button
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="password-input__toggle"
        onClick={onToggle}
        title={visible ? 'Hide password' : 'Show password'}
        type="button"
      >
        <i className={`ph ${visible ? 'ph-eye-slash' : 'ph-eye'}`} aria-hidden="true" />
      </button>
    </div>
  );
});"""
    code = code.replace(old_pi, new_pi)

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

    # 7. Modal helpers
    code = re.sub(r'    if \(user\) \{\n      setUserForm\(\{.*?\n      \}\);\n    \}', 
"""    if (user) {
      userForm.reset({
        employeeCode: user.source.employeeCode ?? '',
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone ?? '',
        jobTitle: user.source.jobTitle ?? user.role ?? '',
        roleId: user.roleId,
        branchId: user.branchId,
        departmentId: user.departmentId,
        status: user.status as any,
        password: '',
        confirmPassword: '',
      });
    }""", code, flags=re.DOTALL)
    
    code = code.replace("setUserForm(emptyUserForm);", """userForm.reset({ employeeCode: '', username: '', email: '', fullName: '', phone: '', jobTitle: '', roleId: '', branchId: '', departmentId: '', password: '', confirmPassword: '', status: 'Active' });""")
    code = code.replace("setPasswordForm({ currentPassword: '', newPassword: '' });", "passwordForm.reset();")
    code = code.replace("setFieldErrors({});", "")

    # 8. Validation and Handlers
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

  const handleSaveUser = async (data: any) => {
    const formData = data as UserFormData;
    if (submitting) return;
    setFormError('');

    if (modalMode === 'create') {
      if (!formData.password) {
        userForm.setError('password', { message: 'Password is required for new users.' });
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        userForm.setError('confirmPassword', { message: 'Passwords must match.' });
        return;
      }
      if (passwordPolicy) {
        const policyErrors = getPasswordPolicyErrors(formData.password, passwordPolicy);
        if (policyErrors.length > 0) {
          userForm.setError('password', { message: `Password must ${policyErrors.join(' and ')}.` });
          return;
        }
      }
    }

    try {
      const payload = buildSavePayload(formData);

      if (modalMode === 'create') {
        await mutations.createUser.mutateAsync({ ...payload, password: formData.password! });
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

    handle_pw_submit = """  const handlePasswordSubmit = async (data: any) => {
    const formData = data as PasswordFormData;
    if (!activeUser || submitting) return;
    setFormError('');
    if (passwordPolicy) {
      const policyErrors = getPasswordPolicyErrors(formData.newPassword, passwordPolicy);
      if (policyErrors.length > 0) {
        passwordForm.setError('newPassword', { message: `Password must ${policyErrors.join(' and ')}.` });
        return;
      }
    }
    try {
      if (modalMode === 'reset-password') {
        await mutations.resetPassword.mutateAsync({ id: activeUser.apiId, newPassword: formData.newPassword });
        showToast('Password reset successfully.');
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

    def repl(m):
        return f"{{...userForm.register('{m.group(1)}')}}"
    code = re.sub(r'onChange=\{\(event\) => updateForm\(\'([a-zA-Z0-9_]+)\', event\.target\.value\)\} (?:required )?(?:type="email" )?value=\{userForm\.[a-zA-Z0-9_]+\}', repl, code)
    code = re.sub(r'onChange=\{\(event\) => updateForm\(\'([a-zA-Z0-9_]+)\', event\.target\.value\)\} value=\{userForm\.[a-zA-Z0-9_]+\}', repl, code)
    code = re.sub(r'onChange=\{\(event\) => updateForm\(\'([a-zA-Z0-9_]+)\', event\.target\.value\)\} required value=\{userForm\.[a-zA-Z0-9_]+\}', repl, code)

    # Clean out branch options and custom select bindings
    code = re.sub(r'aria-invalid=\{Boolean\(fieldErrors\.([a-zA-Z0-9_]+)\)\}', r'', code)
    code = re.sub(r'\{fieldErrors\.([a-zA-Z0-9_]+) \? <small className="field-error">\{fieldErrors\.\1\}</small> : null\}', r'{userForm.formState.errors.\1 ? <small className="field-error">{userForm.formState.errors.\1.message}</small> : null}', code)

    # Passwords
    code = re.sub(r'onChange=\{\(value\) => updateForm\(\'([a-zA-Z0-9_]+)\', value\)\}\n\s*onToggle', lambda m: f"{{...userForm.register('{m.group(1)}')}}\n                      onToggle", code)
    code = re.sub(r'value=\{userForm\.(password|confirmPassword)\}', '', code)

    code = re.sub(r'onChange=\{\(value\) => updatePasswordForm\(\'([a-zA-Z0-9_]+)\', value\)\}\n\s*onToggle', lambda m: f"{{...passwordForm.register('{m.group(1)}')}}\n                      onToggle", code)
    code = re.sub(r'value=\{passwordForm\.(currentPassword|newPassword|confirmNewPassword)\}', '', code)

    # Handle the specific aria-invalids we stripped, adding them back correctly
    code = code.replace('className="field-error">{userForm.formState.errors.currentPassword.message}', 'className="field-error">{passwordForm.formState.errors.currentPassword?.message}')
    code = code.replace('{userForm.formState.errors.currentPassword ?', '{passwordForm.formState.errors.currentPassword ?')
    code = code.replace('className="field-error">{userForm.formState.errors.newPassword.message}', 'className="field-error">{passwordForm.formState.errors.newPassword?.message}')
    code = code.replace('{userForm.formState.errors.newPassword ?', '{passwordForm.formState.errors.newPassword ?')

    # Remove unneeded currentPassword check since it was only in change-password which we don't have
    # Wait, just ensure no TS errors.
    
    with open('apps/web/src/pages/UserManagementPage.tsx', 'w', encoding='utf-8') as f:
        f.write(code)

if __name__ == '__main__':
    fix()
