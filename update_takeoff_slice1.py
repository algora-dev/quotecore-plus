#!/usr/bin/env python3
"""
Slice 1: Add post-calibration instruction modal
"""

import re

FILE_PATH = r"app\(auth)\[workspaceSlug]\quotes\[id]\takeoff\TakeoffWorkstation.tsx"

with open(FILE_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Add state for instruction modal after calibration help state
old_help_state = "  const [showCalibrationHelp, setShowCalibrationHelp] = useState(true);"
new_help_state = """  const [showCalibrationHelp, setShowCalibrationHelp] = useState(true);
  const [showRoofAreaInstructions, setShowRoofAreaInstructions] = useState(false);"""

content = content.replace(old_help_state, new_help_state)

# Step 2: Find the CalibrationModal onSave handler and add instruction modal trigger
# We need to find where addAnother is false and trigger the instruction modal
# Search for the pattern where calibration is saved and modal is closed

# The modal shows when first calibration is complete
# We'll add the instruction modal to show after setShowCalibrationModal(false)

# Since we can't easily find the exact handler, let's add the modal component first
# Then we'll trigger it via a useEffect watching calibrationConfirmed

# Step 3: Add useEffect to show instruction modal after first calibration
old_useeffect_section = "  // Component colors (auto-assign on mount)"
new_useeffect = """  // Show roof area instructions after first calibration confirmed
  useEffect(() => {
    if (calibrationConfirmed && calibrations.length > 0 && roofAreas.length === 0) {
      // Delay slightly to show after calibration flash
      const timer = setTimeout(() => {
        setShowRoofAreaInstructions(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [calibrationConfirmed, calibrations.length, roofAreas.length]);

  // Component colors (auto-assign on mount)"""

content = content.replace(old_useeffect_section, new_useeffect)

# Step 4: Add the instruction modal component before the return statement
# Find a good insertion point - after other modal components

old_modals_section = """      {/* Initial Calibration Help */}
      {showCalibrationHelp && calibrations.length === 0 && ("""

new_modals_section = """      {/* Roof Area Instructions (after first calibration) */}
      {showRoofAreaInstructions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">✅ Calibration Complete!</h2>
            <h3 className="text-lg font-semibold mb-3 text-yellow-400">Next: Create Your First Roof Area</h3>
            <div className="space-y-3 text-sm">
              <p className="text-slate-300">
                Before measuring components, you must define at least one <span className="font-bold">roof area with a pitch angle</span>.
              </p>
              <div className="bg-slate-900/50 border border-slate-700 rounded p-3 space-y-2">
                <p className="font-semibold text-blue-400">How to create a roof area:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 ml-2">
                  <li>Click the <span className="font-bold text-blue-400">"Area"</span> button in the toolbar above</li>
                  <li>Click to place <span className="font-bold">at least 4 points</span> around the roof outline</li>
                  <li>Close the shape by clicking <span className="font-bold">near your starting point</span></li>
                  <li>Enter a <span className="font-bold">name</span> and <span className="font-bold text-orange-400">pitch angle</span> (in degrees)</li>
                </ol>
              </div>
              <p className="text-slate-400 text-xs mt-3">
                💡 The pitch angle is essential for accurate material calculations and component measurements.
              </p>
            </div>
            <button
              onClick={() => {
                setShowRoofAreaInstructions(false);
                // Auto-activate Area mode to help user
                setAreaMode(true);
                setLineMode(false);
                setPointMode(false);
              }}
              className="mt-6 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
            >
              Got it, let's create a roof area!
            </button>
          </div>
        </div>
      )}

      {/* Initial Calibration Help */}
      {showCalibrationHelp && calibrations.length === 0 && ("""

content = content.replace(old_modals_section, new_modals_section)

# Write the updated content
with open(FILE_PATH, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Slice 1 complete: Post-calibration instruction modal added")
print("- Added showRoofAreaInstructions state")
print("- Added useEffect to trigger modal after first calibration")
print("- Added RoofAreaInstructions modal component")
print("- Auto-activates Area mode when user clicks 'Got it'")
