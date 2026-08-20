const fs = require('fs');
let content = fs.readFileSync('apps/web/src/pages/UserManagementPage.tsx', 'utf8');

content = content.replace(/onChange=\{\(event\) => updateForm\('employeeCode', event\.target\.value\)\}\s*placeholder=\"Auto-generated from Dept & Role\"\s*required\s*value=\{userForm\.employeeCode\}/, \placeholder="Auto-generated from Dept & Role"\n                  {...userForm.register('employeeCode')}\);
content = content.replace(/aria-invalid=\{Boolean\(fieldErrors\.employeeCode\)\}/g, \ria-invalid={Boolean(userForm.formState.errors.employeeCode)}\);
content = content.replace(/\{fieldErrors\.employeeCode \? <small className=\"field-error\">\{fieldErrors\.employeeCode\}<\/small> : null\}/g, \{userForm.formState.errors.employeeCode ? <small className="field-error">{userForm.formState.errors.employeeCode.message}</small> : null}\);

content = content.replace(/onChange=\{\(event\) => updateForm\('username', event\.target\.value\)\}\s*placeholder=\"Auto-filled from email\"\s*value=\{userForm\.username\}/, \placeholder="Auto-filled from email"\n                  {...userForm.register('username')}\);
content = content.replace(/aria-invalid=\{Boolean\(fieldErrors\.username\)\}/g, \ria-invalid={Boolean(userForm.formState.errors.username)}\);
content = content.replace(/\{fieldErrors\.username \? <small className=\"field-error\">\{fieldErrors\.username\}<\/small> : null\}/g, \{userForm.formState.errors.username ? <small className="field-error">{userForm.formState.errors.username.message}</small> : null}\);

content = content.replace(/onChange=\{\(event\) => handleEmailChange\(event\.target\.value\)\}\s*required\s*type=\"email\"\s*value=\{userForm\.email\}/, \	ype="email"\n                  {...userForm.register('email')}\);
content = content.replace(/aria-invalid=\{Boolean\(fieldErrors\.email\)\}/g, \ria-invalid={Boolean(userForm.formState.errors.email)}\);
content = content.replace(/\{fieldErrors\.email \? <small className=\"field-error\">\{fieldErrors\.email\}<\/small> : null\}/g, \{userForm.formState.errors.email ? <small className="field-error">{userForm.formState.errors.email.message}</small> : null}\);

content = content.replace(/onChange=\{\(event\) => handleDepartmentChange\(event\.target\.value\)\}\s*required\s*value=\{userForm\.departmentId\}/, \{...userForm.register('departmentId')}\);
content = content.replace(/aria-invalid=\{Boolean\(fieldErrors\.departmentId\)\}/g, \ria-invalid={Boolean(userForm.formState.errors.departmentId)}\);

content = content.replace(/onChange=\{\(event\) => handleRoleChange\(event\.target\.value\)\}\s*required\s*value=\{userForm\.roleId\}/, \{...userForm.register('roleId')}\);
content = content.replace(/aria-invalid=\{Boolean\(fieldErrors\.roleId\)\}/g, \ria-invalid={Boolean(userForm.formState.errors.roleId)}\);

content = content.replace(/onConfirm=\{\(\) => void handleDeleteUser\(\)\}/g, \onConfirm={() => executeDelete()}\);
content = content.replace(/updateUserStatus\(/g, \	oggleStatus(\);

fs.writeFileSync('apps/web/src/pages/UserManagementPage.tsx', content);
