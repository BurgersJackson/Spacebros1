"""MCP JS Validator - JavaScript syntax validation extension for goose."""
import argparse
from .server import mcp


def main():
    """MCP JS Validator: Validate JavaScript syntax using Node.js."""
    parser = argparse.ArgumentParser(
        description="JavaScript syntax validation tools for goose"
    )
    parser.parse_args()
    mcp.run()


if __name__ == "__main__":
    main()
