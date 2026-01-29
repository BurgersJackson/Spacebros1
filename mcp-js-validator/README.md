# MCP JS Validator

A goose extension for JavaScript syntax validation. Automatically validates JavaScript files after edits to catch syntax errors early.

## Features

- **Syntax Validation**: Uses Node.js `--check` flag to detect syntax errors
- **Brace Analysis**: Counts opening/closing braces, parentheses, and brackets
- **Pattern Detection**: Finds common JavaScript syntax error patterns
- **Comprehensive Validation**: Runs all checks in one command
- **Validation Checklist**: Built-in resource with best practices

## Tools

### `validate_javascript(file_path)`
Validates JavaScript syntax using `node --check`.

```python
validate_javascript("src/js/collision-manager.js")
```

### `count_braces(file_path)`
Counts and validates brace balance.

```python
count_braces("src/js/collision-manager.js")
```

### `find_common_patterns(file_path)`
Searches for common syntax error patterns.

```python
find_common_patterns("src/js/collision-manager.js")
```

### `validate_after_edit(file_path)`
Comprehensive validation - runs all checks.

```python
validate_after_edit("src/js/collision-manager.js")
```

## Resources

### `validation://checklist`
Pre and post-edit validation checklist with best practices and emergency recovery procedures.

## Installation

### Using goose CLI

```bash
goose configure
# Select "Add Extension" → "Command-line Extension"
# Enter: mcp-js-validator
# Command: uvx mcp-js-validator
# Or after local install: mcp-js-validator
```

### Using goose Desktop

1. Open Extensions panel
2. Click "Add custom extension"
3. Configure:
   - **Type**: Standard IO
   - **ID**: `js-validator`
   - **Name**: `JavaScript Validator`
   - **Description**: `Validates JavaScript syntax using Node.js`
   - **Command**: `uvx mcp-js-validator` (or `mcp-js-validator` if installed locally)
   - **Timeout**: `30`

### Local Development Install

```bash
cd mcp-js-validator
uv sync
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .
```

Then use `mcp-js-validator` as the command instead of `uvx mcp-js-validator`.

## Usage Examples

### Basic Validation

```bash
# Validate a single file
validate_javascript("src/js/collision-manager.js")

# Count braces
count_braces("src/js/collision-manager.js")

# Find patterns
find_common_patterns("src/js/collision-manager.js")

# Comprehensive validation
validate_after_edit("src/js/collision-manager.js")
```

### Using with Prompts

```
"Use the validate_file_prompt for src/js/collision-manager.js"
```

This will run all validation checks automatically.

### Access Checklist

```
"Get the validation checklist"
```

## Requirements

- Python 3.13 or higher
- Node.js (for `node --check` command)
- `uv` package manager (for installation)

## Development

```bash
# Install dependencies
uv sync

# Run in development mode
mcp dev src/mcp_js_validator/server.py
```

## Error Patterns Detected

- Missing closing braces
- Extra braces
- Catch without try
- Else without if
- Finally without try
- Suspicious brace patterns

## Best Practices

1. Always run `validate_after_edit()` after making changes
2. Check brace count before and after edits
3. Use the checklist resource for guidance
4. Test gameplay after validation passes

## License

MIT
