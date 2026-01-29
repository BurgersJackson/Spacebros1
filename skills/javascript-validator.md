# Skill: JavaScript Code Validator

Automatic validation for JavaScript code changes to catch syntax errors, brace mismatches, and common issues before they're applied.

## Purpose

Prevents syntax errors and code quality issues when making JavaScript changes, especially when using pattern matching and code replacement operations.

## Core Validation Commands

### 1. Syntax Check (REQUIRED after any code change)

```bash
# Check JavaScript syntax without executing
node --check path/to/file.js

# Example
node --check src/js/systems/collision-manager.js
```

**What it catches:**
- Missing/extra braces
- Missing semicolons
- Unterminated strings
- Invalid syntax
- Malformed expressions

**Usage:** Run this after EVERY code modification!

### 2. Brace Balance Check

```bash
# Count opening braces
Get-Content file.js | Select-String -Pattern '\{' | Measure-Object -Line

# Count closing braces  
Get-Content file.js | Select-String -Pattern '\}' | Measure-Object -Line
```

**Usage:** Compare counts - should be equal or close (within 1-2 for comments)

### 3. View Changed Code

```bash
# View specific lines after changes
Get-Content file.js | Select-Object -Skip 1700 -First 50

# Or use text_editor view tool
view("path/to/file.js", [1700, 1750]);
```

## MANDATORY Pre-Apply Checklist

Before using `str_replace`, PowerShell regex, or any code modification:

- [ ] View original code with context (5 lines before/after)
- [ ] Count opening braces in section to be replaced
- [ ] Count closing braces in section to be replaced
- [ ] Verify pattern is unique (appears only once)
- [ ] Plan exact replacement text including ALL braces
- [ ] Document expected brace count before/after

## MANDATORY Post-Apply Checklist

After applying ANY code change:

- [ ] Run `node --check path/to/file.js` IMMEDIATELY
- [ ] If syntax error: View error line ± 20 lines
- [ ] Count braces in changed section
- [ ] Verify indentation is correct
- [ ] Fix any issues immediately
- [ ] Re-run syntax check until clean

## Common Error Patterns

### Pattern 1: Missing Closing Brace

**Symptom:** `Uncaught SyntaxError: Unexpected token 'catch'`

**Detection:**
```bash
# Count braces around error line (assume error on line 1785)
Get-Content file.js | Select-Object -Skip 1765 -First 40 | Select-String '\{','\}'
```

**Fix:** Add the missing brace with correct indentation

### Pattern 2: Extra Brace

**Symptom:** `Uncaught SyntaxError: Unexpected token '}'`

**Detection:**
```bash
# View area around error
Get-Content file.js | Select-Object -Skip ($errorLine - 11) -First 25
```

**Fix:** Remove the extra brace

### Pattern 3: Pattern Appears Multiple Times

**Symptom:** str_replace fails with "appears multiple times"

**Solution:** Make pattern more unique by:
- Adding more surrounding context
- Including line numbers
- Using more specific code snippets

## Safe Replacement Strategy

### Method 1: Use Exact Line Numbers

```javascript
// 1. View the exact lines
view("path/to/file.js", [1708, 1724]);

// 2. Copy EXACT text including all whitespace
// 3. Use str_replace with exact match
```

### Method 2: Incremental Changes

```javascript
// Make changes in small increments
// Test after each change

// Step 1: Add new function at end of file
// Step 2: Test syntax
// Step 3: Wire function into existing code  
// Step 4: Test syntax again
```

### Method 3: View Before Replace

```javascript
// ALWAYS view before replacing
view("file.js", [start, end]);

// Then use exact text from view output
str_replace("file.js", {
    old_str: "COPY EXACT FROM VIEW OUTPUT",
    new_str: "NEW TEXT WITH ALL BRACES"
});
```

## PowerShell Regex Rules

### DO:

```powershell
# Use here-strings for multi-line patterns
$pattern = @'
line 1
line 2
'@

# Use simple patterns when possible
$content -replace 'oldText', 'newText'

# Test pattern before applying
$content -match $pattern
```

### DON'T:

```powershell
# Don't use complex regex for code
$pattern = 'if.*\{.*\}' # WILL FAIL

# Don't forget to escape special chars
$pattern = 'if (condition)' # Missing backslash escapes

# Don't mix quote types in here-strings
@'text with "quotes"'@ # OK
@"text with 'quotes'"@ # OK
@'mixed "quotes' bad"@ # BROKEN
```

## Quick Reference Card

```
BEFORE ANY CODE CHANGE:
1. view(file, [start, end])
2. Count { and } in section
3. Verify pattern is unique
4. Copy EXACT text for old_str

AFTER ANY CODE CHANGE:
1. node --check file.js (MANDATORY!)
2. If error: view(file, [error-20, error+20])
3. Count braces again
4. Fix issues
5. Repeat until clean

IF SYNTAX ERROR:
- Check for missing }
- Check for extra }
- Check indentation
- View error location
- Count braces before/after

EMERGENCY RECOVERY:
git checkout -- path/to/file.js
```

## Automated Validation

Create this helper function in your workflow:

```javascript
async function validateJS(filePath) {
    // Run syntax check
    const result = await shell(`node --check ${filePath}`);
    
    if (result.includes('SyntaxError')) {
        // Extract error line
        const match = result.match(/:(\d+):\d+/);
        if (match) {
            const errorLine = parseInt(match[1]);
            console.log(`Syntax error at line ${errorLine}`);
            
            // View error area
            view(filePath, [errorLine - 20, errorLine + 20]);
        }
        return false;
    }
    
    console.log('✓ Syntax OK');
    return true;
}
```

**Usage:**
```javascript
// After any code change
await validateJS('src/js/systems/collision-manager.js');
```

## Emergency Recovery

If you completely break a file:

```bash
# Revert the file
git checkout -- path/to/file.js

# Start over with smaller changes
# Replace 5-10 lines at a time
# Test after each change
# Build up to full change
```

## Integration with Current Work

For the explosive shield feature, use this validation:

```javascript
// After each explosive code addition:
await validateJS('src/js/systems/collision-manager.js');

// If syntax error:
// 1. Note the error line
// 2. View that line ± 20
// 3. Count braces in the section
// 4. Fix missing/extra braces
// 5. Re-validate
```

## Remember

- **Always** validate after code changes
- **Never** skip syntax checking
- **Count braces** before and after
- **View code** before replacing
- **Test incrementally** for large changes

It's faster to validate carefully than to fix broken code!
