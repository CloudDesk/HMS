import re

with open('apps/web/src/pages/UserManagementPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace state variables and form init
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
code = re.sub(r'  const updateForm = \(field: keyof UserFormState, value: string\) => \{.*?\};\n', '', code, flags=re.DOTALL)
code = re.sub(r'  const updatePasswordForm = \(field: keyof PasswordFormState, value: string\) => \{.*?\};\n', '', code, flags=re.DOTALL)

# Replace openModal
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
      status: user?.status ?? 'Active',
    });
    passwordForm.reset({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  };"""
code = re.sub(r'  const openModal = \(mode: ModalMode, user\?: UiUser\) => \{.*?setModalMode\(mode\);\n  \};\n', open_modal_replacement + '\n', code, flags=re.DOTALL)

# Replace buildSavePayload
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

# Replace handleSaveUser and validateUserForm
handle_save_replacement = """  const handleSaveUser = async (data: UserFormData) => {
    if (submitting) return;
    setFormError('');

    // Dynamic password policy check for create mode
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

code = re.sub(r'  const handleSaveUser = async \(event: FormEvent\) => \{.*?catch \(error\) \{\n      setFormError\(getErrorMessage\(error\)\);\n    \}\n  \};\n', '', code, flags=re.DOTALL)
code = re.sub(r'  const validateUserForm = \(\) => \{.*?\n  \};\n', handle_save_replacement + '\n', code, flags=re.DOTALL)

# Now replace the password reset handler mapping
code = re.sub(r'  const handlePasswordReset = async \(event: FormEvent\) => \{.*?catch \(error\) \{\n      setFormError\(getErrorMessage\(error\)\);\n    \}\n  \};\n', '', code, flags=re.DOTALL)

with open('apps/web/src/pages/UserManagementPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
