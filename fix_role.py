import re
with open('apps/web/src/pages/RolesPermissionsPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

guard = """const isApiRoleStatus = (val: string): val is ApiRoleStatus => val === 'active' || val === 'inactive';
"""

code = code.replace("const roleStatusLabel = (status: ApiRoleStatus) =>", guard + "\nconst roleStatusLabel = (status: ApiRoleStatus) =>")

code = code.replace("onChange={(event) => { setStatusFilter(event.target.value as ApiRoleStatus | ''); setRolePage(1); }}",
"onChange={(event) => { const val = event.target.value; setStatusFilter(isApiRoleStatus(val) ? val : ''); setRolePage(1); }}")

with open('apps/web/src/pages/RolesPermissionsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
