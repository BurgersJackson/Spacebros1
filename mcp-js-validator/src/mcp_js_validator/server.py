"""MCP Server for JavaScript syntax validation."""
import subprocess
import re
from pathlib import Path
from mcp.server.fastmcp import FastMCP
from mcp.shared.exceptions import McpError
from mcp.types import ErrorData, INTERNAL_ERROR, INVALID_PARAMS

mcp = FastMCP("js-validator")


@mcp.tool()
def validate_javascript(file_path: str) -> str:
    """
    Validate JavaScript syntax using Node.js --check flag.
    
    This runs 'node --check' on the specified file to detect syntax errors
    without executing the code.
    
    Usage:
        validate_javascript("src/js/collision-manager.js")
    
    Args:
        file_path: Path to the JavaScript file to validate
    
    Returns:
        Validation result with error details if syntax issues found
    """
    try:
        path = Path(file_path)
        
        # Validate input
        if not path.exists():
            raise ValueError(f"File not found: {file_path}")
        
        if not path.suffix in ['.js', '.mjs', '.cjs']:
            raise ValueError(f"Not a JavaScript file: {file_path}")
        
        # Run node --check
        result = subprocess.run(
            ['node', '--check', str(path)],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            return f"✅ No syntax errors found in {file_path}"
        else:
            # Parse the error output
            error_output = result.stderr or result.stdout
            return f"❌ Syntax errors found in {file_path}:\n\n{error_output}"
    
    except ValueError as e:
        raise McpError(ErrorData(code=INVALID_PARAMS, message=str(e)))
    except subprocess.TimeoutExpired:
        raise McpError(ErrorData(code=INTERNAL_ERROR, message="Validation timeout"))
    except Exception as e:
        raise McpError(ErrorData(code=INTERNAL_ERROR, message=f"Validation error: {str(e)}"))


@mcp.tool()
def count_braces(file_path: str) -> str:
    """
    Count opening and closing braces in a JavaScript file.
    
    This helps identify brace mismatch issues that cause syntax errors.
    
    Usage:
        count_braces("src/js/collision-manager.js")
    
    Args:
        file_path: Path to the JavaScript file to analyze
    
    Returns:
        Brace count analysis with mismatch warnings
    """
    try:
        path = Path(file_path)
        
        if not path.exists():
            raise ValueError(f"File not found: {file_path}")
        
        content = path.read_text(encoding='utf-8')
        
        # Count braces (excluding comments and strings would be better, but simple count is useful)
        open_braces = content.count('{')
        close_braces = content.count('}')
        open_parens = content.count('(')
        close_parens = content.count(')')
        open_brackets = content.count('[')
        close_brackets = content.count(']')
        
        result = [
            f"📊 Brace analysis for {file_path}:",
            "",
            f"Curly braces: {{ {open_braces} }} {close_braces}",
            f"Parentheses: ( {open_parens} ) {close_parens}",
            f"Brackets: [ {open_brackets} ] {close_brackets}",
            ""
        ]
        
        # Check for mismatches
        issues = []
        if open_braces != close_braces:
            issues.append(f"⚠️  Curly brace mismatch: {open_braces - close_braces:+d}")
        if open_parens != close_parens:
            issues.append(f"⚠️  Parenthesis mismatch: {open_parens - close_parens:+d}")
        if open_brackets != close_brackets:
            issues.append(f"⚠️  Bracket mismatch: {open_brackets - close_brackets:+d}")
        
        if issues:
            result.append("Issues found:")
            result.extend(issues)
            result.append("")
            result.append("💡 Tip: Use validate_javascript() for detailed error location")
        else:
            result.append("✅ All braces are balanced!")
        
        return "\n".join(result)
    
    except ValueError as e:
        raise McpError(ErrorData(code=INVALID_PARAMS, message=str(e)))
    except Exception as e:
        raise McpError(ErrorData(code=INTERNAL_ERROR, message=f"Analysis error: {str(e)}"))


@mcp.tool()
def find_common_patterns(file_path: str) -> str:
    """
    Search for common JavaScript syntax error patterns in a file.
    
    Looks for frequent issues like:
    - Missing semicolons in certain contexts
    - Suspicious patterns that often indicate errors
    - Common syntax mistakes
    
    Usage:
        find_common_patterns("src/js/collision-manager.js")
    
    Args:
        file_path: Path to the JavaScript file to analyze
    
    Returns:
        List of potential issues found
    """
    try:
        path = Path(file_path)
        
        if not path.exists():
            raise ValueError(f"File not found: {file_path}")
        
        content = path.read_text(encoding='utf-8')
        lines = content.split('\n')
        issues = []
        
        # Common patterns to check
        patterns = [
            (r'^\s*catch\s*\(', 'catch statement without try'),
            (r'^\s*}\s*else\s*', 'else without proper if/else structure'),
            (r'^\s*}\s*catch\s*\(', 'catch without try'),
            (r'^\s*}\s*finally\s*', 'finally without try'),
            (r'\{\s*$', 'Opening brace at end of line (check for missing closing brace)'),
            (r'\}\s*\{\s*$', 'Back-to-back braces (check for missing code between blocks)'),
        ]
        
        for line_num, line in enumerate(lines, 1):
            for pattern, description in patterns:
                if re.search(pattern, line):
                    issues.append(f"Line {line_num}: {description.strip()}")
                    issues.append(f"  {line.strip()[:80]}")
                    issues.append("")
        
        if not issues:
            return f"✅ No common error patterns found in {file_path}"
        
        result = [
            f"🔍 Potential issues found in {file_path}:",
            "",
            *issues[:20],  # Limit to first 20 issues
            ""
        ]
        
        if len(issues) > 20:
            result.append(f"... and {len(issues) - 20} more issues")
        
        result.append("💡 Tip: These are potential issues. Use validate_javascript() for confirmation")
        
        return "\n".join(result)
    
    except ValueError as e:
        raise McpError(ErrorData(code=INVALID_PARAMS, message=str(e)))
    except Exception as e:
        raise McpError(ErrorData(code=INTERNAL_ERROR, message=f"Pattern matching error: {str(e)}"))


@mcp.tool()
def validate_after_edit(file_path: str) -> str:
    """
    Comprehensive validation after editing a JavaScript file.
    
    This runs all validation checks in sequence:
    1. Syntax validation with node --check
    2. Brace counting
    3. Common pattern detection
    
    Use this after making code changes to catch errors early.
    
    Usage:
        validate_after_edit("src/js/collision-manager.js")
    
    Args:
        file_path: Path to the JavaScript file to validate
    
    Returns:
        Complete validation report
    """
    try:
        path = Path(file_path)
        
        if not path.exists():
            raise ValueError(f"File not found: {file_path}")
        
        results = []
        results.append(f"🔬 Comprehensive validation for {file_path}")
        results.append("=" * 60)
        results.append("")
        
        # Run all validations
        results.append("1️⃣ Syntax Validation:")
        results.append("-" * 60)
        syntax_result = validate_javascript(file_path)
        results.append(syntax_result)
        results.append("")
        
        results.append("2️⃣ Brace Analysis:")
        results.append("-" * 60)
        brace_result = count_braces(file_path)
        results.append(brace_result)
        results.append("")
        
        results.append("3️⃣ Pattern Detection:")
        results.append("-" * 60)
        pattern_result = find_common_patterns(file_path)
        results.append(pattern_result)
        results.append("")
        
        # Overall status
        if "❌" in syntax_result or "⚠️" in brace_result or "Potential issues" in pattern_result:
            results.append("⚠️  VALIDATION FAILED - Please review the issues above")
        else:
            results.append("✅ ALL CHECKS PASSED - File looks good!")
        
        return "\n".join(results)
    
    except ValueError as e:
        raise McpError(ErrorData(code=INVALID_PARAMS, message=str(e)))
    except Exception as e:
        raise McpError(ErrorData(code=INTERNAL_ERROR, message=f"Validation error: {str(e)}"))


@mcp.resource("validation://checklist")
def get_validation_checklist() -> str:
    """
    Get the pre and post-apply validation checklist.
    
    Returns a comprehensive checklist for validating JavaScript code changes.
    """
    return """
# JavaScript Validation Checklist

## Pre-Apply Checklist (Before Making Changes)

- [ ] Read the full context around the change
- [ ] Identify all opening and closing braces in affected area
- [ ] Note any existing syntax in the block you're modifying
- [ ] Count braces before: Use count_braces() on the file
- [ ] Run initial validation: validate_javascript() to ensure file is clean

## Post-Apply Checklist (After Making Changes)

- [ ] Run node --check: validate_javascript()
- [ ] Count braces again: count_braces() - should match pre-apply count
- [ ] Check for common patterns: find_common_patterns()
- [ ] Run comprehensive validation: validate_after_edit()
- [ ] Test the game to ensure gameplay isn't altered (unless intentional)

## Common Error Patterns

1. **Missing Closing Braces**
   - Symptom: "Unexpected token" or "Unexpected end of input"
   - Fix: Count braces, add missing } at appropriate location

2. **Extra Braces**
   - Symptom: Code blocks don't execute as expected
   - Fix: Remove duplicate } braces

3. **Catch Without Try**
   - Symptom: "Unexpected token 'catch'"
   - Fix: Ensure try block exists before catch

4. **Else Without If**
   - Symptom: "Unexpected token 'else'"
   - Fix: Check if/else structure is complete

## Emergency Recovery

If validation fails after edits:
1. Use git to revert: git checkout -- filename.js
2. Or restore from backup before trying again
3. Always validate BEFORE committing changes

## Best Practices

1. Make small, incremental changes
2. Validate after each change
3. Use comprehensive validation: validate_after_edit()
4. Keep backups of working files
5. Test gameplay after validation passes
"""


@mcp.prompt()
def validate_file_prompt(file_path: str) -> str:
    """
    Generate a prompt for validating a JavaScript file.
    
    Usage in goose: "Use the validate_file_prompt for src/js/collision-manager.js"
    """
    return f"""
Please validate the JavaScript file: {file_path}

Run these checks in order:
1. validate_javascript("{file_path}") - Check for syntax errors
2. count_braces("{file_path}") - Verify braces are balanced
3. find_common_patterns("{file_path}") - Look for common issues
4. validate_after_edit("{file_path}") - Run comprehensive validation

Report any issues found and suggest fixes.
"""
