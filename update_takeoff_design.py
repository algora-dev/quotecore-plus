#!/usr/bin/env python3
"""
Slice 3: Update digital takeoff design to match platform
"""

FILE_PATH = r"app\(auth)\[workspaceSlug]\quotes\[id]\takeoff\TakeoffWorkstation.tsx"

# Define all color/style replacements
replacements = [
    # Background colors
    ("bg-slate-900", "bg-gray-50"),
    ("bg-slate-800", "bg-white"),
    ("bg-slate-700", "bg-gray-100"),
    ("bg-slate-600", "bg-gray-200"),
    ("bg-slate-500", "bg-gray-300"),
    
    # Text colors
    ("text-white", "text-gray-900"),
    ("text-slate-400", "text-gray-600"),
    ("text-slate-300", "text-gray-700"),
    ("text-slate-500", "text-gray-500"),
    
    # Border colors
    ("border-slate-700", "border-gray-200"),
    ("border-slate-600", "border-gray-300"),
    
    # Hover states for buttons
    ("hover:bg-slate-600", "hover:bg-gray-200"),
    ("hover:bg-slate-700", "hover:bg-gray-100"),
    ("hover:bg-slate-650", "hover:bg-gray-150"),
    
    # Specific component styles - make boxes rounded
    ("rounded-lg", "rounded-xl"),
    
    # Update specific colored elements to be more subtle
    ("bg-yellow-600/20", "bg-amber-50"),
    ("border-yellow-600", "border-amber-300"),
    ("text-yellow-400", "text-amber-600"),
    
    ("bg-green-600/20", "bg-emerald-50"),
    ("border-green-600", "border-emerald-300"),
    
    ("bg-blue-600/20", "bg-blue-50"),
    ("border-blue-600", "border-blue-300"),
    
    ("bg-red-600/20", "bg-red-50"),
    
    # Canvas container
    ("border-2 border-slate-700", "border-2 border-gray-300 shadow-sm"),
]

with open(FILE_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# Apply all replacements
for old, new in replacements:
    content = content.replace(old, new)

# Write back
with open(FILE_PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✅ Applied {len(replacements)} style replacements")
print("Updated digital takeoff design to match platform:")
print("  - White backgrounds instead of dark")
print("  - Gray text instead of white")
print("  - Rounded corners (rounded-xl)")
print("  - Subtle colored backgrounds for badges")
print("  - Light borders")
