import re
with open('apps/web/src/pages/DashboardShell.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

guard = """const isDashboardTab = (val: string | null): val is DashboardTab => {
  return val !== null && ['overview', 'doctors', 'appointments', 'opd', 'billing', 'admin'].includes(val);
};"""
code = code.replace("type DashboardTab = 'overview' | 'doctors' | 'appointments' | 'opd' | 'billing' | 'admin';", "type DashboardTab = 'overview' | 'doctors' | 'appointments' | 'opd' | 'billing' | 'admin';\n\n" + guard)
code = code.replace("const requestedTab = (searchParams.get('tab') as DashboardTab) || 'overview';", "const rawTab = searchParams.get('tab');\n  const requestedTab = isDashboardTab(rawTab) ? rawTab : 'overview';")

with open('apps/web/src/pages/DashboardShell.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
