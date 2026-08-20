import re

with open('apps/web/src/pages/UserManagementPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace <form onSubmit={handleSaveUser}>
code = code.replace(
    "<form onSubmit={handleSaveUser}>",
    "<form onSubmit={userForm.handleSubmit(handleSaveUser)}>"
)
code = code.replace(
    "<form onSubmit={handlePasswordReset}>",
    "<form onSubmit={passwordForm.handleSubmit(handlePasswordReset)}>"
)

# Replace manual inputs with register
# e.g., value={userForm.fullName} onChange={(event) => updateForm('fullName', event.target.value)}
# with {...userForm.register('fullName')}

def replace_input(match):
    field = match.group(1)
    return f"{{...userForm.register('{field}')}}"

# Text inputs
code = re.sub(r'onChange=\{\(event\) => updateForm\(\'([a-zA-Z0-9_]+)\', event\.target\.value\)\} (?:type="[a-z]+" )?value=\{userForm\.[a-zA-Z0-9_]+\}', replace_input, code)
code = re.sub(r'(?:type="[a-z]+" )?value=\{userForm\.([a-zA-Z0-9_]+)\} onChange=\{\(event\) => updateForm\(\'[a-zA-Z0-9_]+\', event\.target\.value\)\}', replace_input, code)
code = re.sub(r'onChange=\{\(e\) => updateForm\(\'([a-zA-Z0-9_]+)\', e\.target\.value\)\} value=\{userForm\.[a-zA-Z0-9_]+\}', replace_input, code)
code = re.sub(r'value=\{userForm\.([a-zA-Z0-9_]+)\} onChange=\{\(e\) => updateForm\(\'[a-zA-Z0-9_]+\', e\.target\.value\)\}', replace_input, code)


# Password form inputs
def replace_password_input(match):
    field = match.group(1)
    return f"{{...passwordForm.register('{field}')}}"

code = re.sub(r'onChange=\{\(e\) => updatePasswordForm\(\'([a-zA-Z0-9_]+)\', e\.target\.value\)\} type="password" value=\{passwordForm\.[a-zA-Z0-9_]+\}', replace_password_input, code)
code = re.sub(r'type="password" value=\{passwordForm\.([a-zA-Z0-9_]+)\} onChange=\{\(e\) => updatePasswordForm\(\'[a-zA-Z0-9_]+\', e\.target\.value\)\}', replace_password_input, code)

# Errors: fieldErrors.fullName -> userForm.formState.errors.fullName?.message
code = re.sub(r'fieldErrors\.([a-zA-Z0-9_]+)', r'userForm.formState.errors.\1?.message', code)
# Password form errors
code = re.sub(r'userForm\.formState\.errors\.(currentPassword|newPassword|confirmNewPassword)\?\.message', r'passwordForm.formState.errors.\1?.message', code)

with open('apps/web/src/pages/UserManagementPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
