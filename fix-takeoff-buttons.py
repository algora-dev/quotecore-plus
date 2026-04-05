import re

file_path = 'app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern 1: Calibration modal buttons (Cancel, Skip, Save buttons)
content = re.sub(
    r'className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"',
    'className="px-4 py-2 bg-white border-2 border-slate-300 rounded-full pill-shimmer"',
    content
)

content = re.sub(
    r'className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"',
    'className="px-4 py-2 bg-white border-2 border-slate-300 rounded-full pill-shimmer"',
    content
)

content = re.sub(
    r'className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-400 rounded"',
    'className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"',
    content
)

# Pattern 2: Roof area modal buttons
content = re.sub(
    r'className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"',
    'className="px-4 py-2 border-2 border-slate-300 rounded-full pill-shimmer"',
    content
)

content = re.sub(
    r'className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"',
    'className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"',
    content
)

content = re.sub(
    r'className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"',
    'className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"',
    content
)

# Pattern 3: Component name modal buttons
content = re.sub(
    r'className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"',
    'className="px-4 py-2 border-2 border-slate-300 rounded-full pill-shimmer"',
    content
)

content = re.sub(
    r'className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"',
    'className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"',
    content
)

# Pattern 4: Tool buttons (Area, Line, Point) - add shimmer effect
content = re.sub(
    r'(className="px-3 py-2 rounded-md border-2 )(border-gray-300 bg-gray-100)',
    r'\1border-transparent bg-gray-100 pill-shimmer',
    content
)

content = re.sub(
    r'(className="px-3 py-2 rounded-md border-2 )(border-blue-500 bg-blue-100)',
    r'\1border-orange-500 bg-orange-100',
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated all takeoff buttons and tools!")
print("  - Calibration modal buttons: black/white pills")
print("  - Roof area modal buttons: black/white pills")  
print("  - Component modal buttons: black/white pills")
print("  - Tool buttons: shimmer + orange selected state")
