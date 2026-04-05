import re

file_path = 'app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Change border-2 border-orange to border border-orange (2px -> 1px)
content = re.sub(
    r'border-2 border-orange',
    'border border-orange',
    content
)

# Change ring-2 ring-orange to ring-1 ring-orange (selected component)
content = re.sub(
    r'ring-2 ring-orange',
    'ring-1 ring-orange',
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated border thickness!")
print("  - border-2 -> border (2px to 1px)")
print("  - ring-2 -> ring-1 (selected component)")
