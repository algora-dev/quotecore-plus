import re

file_path = 'app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: "Add Line (Enter)" button - emerald -> black
content = re.sub(
    r'className="px-4 py-2 bg-emerald-400 hover:bg-emerald-500 text-white rounded"',
    'className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"',
    content
)

# Fix 2: "Add Point (Enter)" button - purple -> black
content = re.sub(
    r'className="px-4 py-2 bg-purple-400 hover:bg-purple-500 text-white rounded"',
    'className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"',
    content
)

# Fix 3: "Confirm Calibration" button - emerald -> black + full rounded
content = re.sub(
    r'className="w-full px-3 py-2 bg-emerald-400 hover:bg-emerald-500 text-white rounded-full',
    'className="w-full px-3 py-2 bg-black hover:bg-slate-800 text-white rounded-full',
    content
)

# Fix 4: Tool buttons - change selected state from blue to orange
# Pattern: border-blue-500 bg-blue-100 -> border-orange-500 bg-orange-100
content = re.sub(
    r'border-blue-500 bg-blue-100',
    'border-orange-500 bg-orange-100',
    content
)

# Fix 5: Also change teal variants
content = re.sub(
    r'border-teal-500 bg-teal-100',
    'border-orange-500 bg-orange-100',
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated remaining takeoff buttons!")
print("  - Add Line/Point buttons: black + orange glow")
print("  - Confirm Calibration: black")
print("  - Tool selected state: orange background")
