import re

file_path = 'app/(auth)/[workspaceSlug]/quotes/[id]/build/QuoteBuilderV2.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: "Next: Components →" button
content = re.sub(
    r'className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"',
    'className="px-6 py-3 bg-black text-white font-medium rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"',
    content
)

# Fix 2: Green "Confirm Quote" button
content = re.sub(
    r'className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"',
    'className="px-6 py-3 bg-black text-white font-medium rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"',
    content
)

# Fix 3: Tab active state colors (blue -> orange)
content = re.sub(
    r"bg-blue-50 text-blue-700 border-b-2 border-blue-600",
    "bg-orange-50 text-orange-700 border-b-2 border-orange-500",
    content
)

content = re.sub(
    r"bg-blue-600 text-white",
    "bg-orange-500 text-white",
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated QuoteBuilderV2.tsx!")
print("  - Navigation buttons: black + orange glow")
print("  - Confirm Quote button: black + orange glow")  
print("  - Active tabs: orange accent")
