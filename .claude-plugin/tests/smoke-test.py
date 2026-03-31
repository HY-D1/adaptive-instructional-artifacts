#!/usr/bin/env python3
"""
Plugin Smoke Test Suite for Team Pilot Validation
Tests plugin scaffold, state isolation, and research workflow
"""

import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime

class PluginSmokeTest:
    """Automated smoke tests for quality-loop-deerflow plugin"""

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.plugin_dir = self.project_root / ".claude-plugin"
        self.state_dir = self.project_root / ".claude" / "state"
        self.results = []
        self.passed = 0
        self.failed = 0

    def log(self, test_name: str, status: bool, details: str = ""):
        """Log test result"""
        self.results.append({
            "test": test_name,
            "status": "PASS" if status else "FAIL",
            "details": details
        })
        if status:
            self.passed += 1
        else:
            self.failed += 1
        print(f"  {'✓' if status else '✗'} {test_name}")
        if details:
            print(f"    {details}")

    def test_plugin_structure(self) -> bool:
        """Test 1: Verify plugin scaffold structure"""
        print("\n📁 Testing Plugin Structure...")
        all_pass = True

        required_files = [
            "plugin.json",
            "README.md",
            "commands/research.md",
            "commands/research-status.md",
            "agents/deerflow-runner.md",
            "skills/deerflow-research/SKILL.md",
            "config/routing-policy.md"
        ]

        for file_path in required_files:
            full_path = self.plugin_dir / file_path
            exists = full_path.exists()
            self.log(f"Required file: {file_path}", exists,
                    "" if exists else f"Missing: {full_path}")
            if not exists:
                all_pass = False

        return all_pass

    def test_plugin_json_valid(self) -> bool:
        """Test 2: Verify plugin.json is valid JSON"""
        print("\n📋 Testing Plugin Manifest...")
        plugin_json_path = self.plugin_dir / "plugin.json"

        try:
            with open(plugin_json_path) as f:
                manifest = json.load(f)

            # Check required fields
            required = ["name", "version", "entrypoints"]
            missing = [f for f in required if f not in manifest]

            if missing:
                self.log("Plugin manifest fields", False, f"Missing: {missing}")
                return False

            # Check entrypoints structure
            entrypoints = manifest.get("entrypoints", {})
            has_commands = "commands" in entrypoints
            has_agents = "agents" in entrypoints
            has_skills = "skills" in entrypoints

            self.log("Has commands entrypoint", has_commands)
            self.log("Has agents entrypoint", has_agents)
            self.log("Has skills entrypoint", has_skills)

            # Check state boundary config
            config = manifest.get("config", {})
            has_state_boundary = "state_boundary" in config
            has_output_isolation = "output_isolation" in config

            self.log("Has state_boundary config", has_state_boundary)
            self.log("Has output_isolation config", has_output_isolation)

            all_pass = all([has_commands, has_agents, has_skills,
                          has_state_boundary, has_output_isolation])

            if all_pass:
                self.log("Plugin manifest valid", True)

            return all_pass

        except json.JSONDecodeError as e:
            self.log("Plugin manifest valid JSON", False, str(e))
            return False
        except FileNotFoundError:
            self.log("Plugin manifest exists", False, "plugin.json not found")
            return False

    def test_no_absolute_paths(self) -> bool:
        """Test 3: Verify no runtime-critical absolute paths"""
        print("\n🔍 Testing for Absolute Paths...")

        # Patterns that indicate absolute paths
        absolute_patterns = [
            r'/Users/\w+',           # macOS user paths
            r'/home/\w+',            # Linux user paths
            r'C:\\\\',              # Windows paths
            r'file:///Users/',       # file:// URLs
            r'file:///home/',
        ]

        found_issues = []
        files_checked = 0

        # Check all .md and .json files in plugin
        for ext in ["*.md", "*.json"]:
            for file_path in self.plugin_dir.rglob(ext):
                # Skip test files and reports (they may contain examples)
                if "test" in str(file_path) or "report" in str(file_path):
                    continue

                files_checked += 1
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()

                    for pattern in absolute_patterns:
                        matches = re.findall(pattern, content)
                        if matches:
                            found_issues.append(f"{file_path}: {matches}")

                except Exception as e:
                    found_issues.append(f"{file_path}: Error reading - {e}")

        no_abs_paths = len(found_issues) == 0
        self.log(f"Checked {files_checked} files for absolute paths", True)
        self.log("No absolute paths in runtime files", no_abs_paths,
                "; ".join(found_issues[:3]) if found_issues else "")

        return no_abs_paths

    def test_state_isolation(self) -> bool:
        """Test 4: Verify state isolation configuration"""
        print("\n🔒 Testing State Isolation...")

        plugin_json_path = self.plugin_dir / "plugin.json"

        try:
            with open(plugin_json_path) as f:
                manifest = json.load(f)

            config = manifest.get("config", {})
            state_boundary = config.get("state_boundary", {})
            write_forbidden = state_boundary.get("write_forbidden", [])

            required_forbidden = [
                ".claude/state/quality-loop.json",
                ".claude/state/evidence-manifest.json",
                ".claude/state/activity.json"
            ]

            all_forbidden = all(f in write_forbidden for f in required_forbidden)

            self.log("write_forbidden defined", bool(write_forbidden))
            self.log("quality-loop.json forbidden",
                    ".claude/state/quality-loop.json" in write_forbidden)
            self.log("evidence-manifest.json forbidden",
                    ".claude/state/evidence-manifest.json" in write_forbidden)
            self.log("activity.json forbidden",
                    ".claude/state/activity.json" in write_forbidden)

            output_isolation = config.get("output_isolation", {})
            has_base_path = "base_path" in output_isolation
            has_research_subdir = "research_subdir" in output_isolation

            self.log("output_isolation.base_path defined", has_base_path,
                    f"base_path = {output_isolation.get('base_path', 'NOT SET')}")
            self.log("output_isolation.research_subdir defined", has_research_subdir,
                    f"research_subdir = {output_isolation.get('research_subdir', 'NOT SET')}")

            return all_forbidden and has_base_path and has_research_subdir

        except Exception as e:
            self.log("State isolation config", False, str(e))
            return False

    def test_research_output_structure(self) -> bool:
        """Test 5: Verify research output directory structure"""
        print("\n📂 Testing Research Output Structure...")

        # Check if state directory exists
        runs_dir = self.state_dir / "runs"

        if not runs_dir.exists():
            self.log("runs/ directory exists", False,
                    "Initialize with: mkdir -p .claude/state/runs")
            return False

        self.log("runs/ directory exists", True)

        # Look for any research run directories
        research_runs = list(runs_dir.glob("research-*"))

        if not research_runs:
            self.log("Research runs found", False,
                    "No research runs yet - this is OK for initial install")
            # This is not a failure - just means no research has been run
            return True

        self.log(f"Found {len(research_runs)} research run(s)", True)

        # Validate structure of latest run
        latest_run = max(research_runs, key=lambda p: p.stat().st_mtime)
        research_dir = latest_run / "research"

        if research_dir.exists():
            self.log(f"Research subdirectory exists in {latest_run.name}", True)

            # Check for expected files
            expected_files = ["request.json", "findings.json", "sources.json", "status.json"]
            for fname in expected_files:
                exists = (research_dir / fname).exists()
                self.log(f"  {fname}", exists)
        else:
            self.log(f"Research subdirectory in {latest_run.name}", False)

        return True

    def test_no_shared_state_pollution(self) -> bool:
        """Test 6: Verify no shared state files were created in wrong location"""
        print("\n🛡️  Testing No Shared State Pollution...")

        shared_state_files = [
            "quality-loop.json",
            "evidence-manifest.json",
            "activity.json",
            "task-profile.json"
        ]

        all_clean = True
        for fname in shared_state_files:
            file_path = self.state_dir / fname
            exists = file_path.exists()
            # For test projects, these should NOT exist (they're only in main project)
            self.log(f"{fname} not in test project root", not exists,
                    "Found in wrong location" if exists else "Correctly absent")
            if exists:
                all_clean = False

        return all_clean

    def test_routing_policy_documented(self) -> bool:
        """Test 7: Verify routing policy is documented"""
        print("\n📖 Testing Routing Policy Documentation...")

        routing_policy_path = self.plugin_dir / "config" / "routing-policy.md"

        if not routing_policy_path.exists():
            self.log("Routing policy file exists", False)
            return False

        with open(routing_policy_path) as f:
            content = f.read()

        # Check for key sections
        has_deerflow_section = "DeerFlow" in content
        has_quality_loop_section = "quality-loop" in content or "Quality Loop" in content
        has_examples = "Example" in content

        self.log("Routing policy exists", True)
        self.log("Documents DeerFlow usage", has_deerflow_section)
        self.log("Documents quality-loop integration", has_quality_loop_section)
        self.log("Contains examples", has_examples)

        return has_deerflow_section and has_quality_loop_section

    def run_all_tests(self) -> dict:
        """Run all smoke tests and return summary"""
        print("=" * 60)
        print("🔥 PLUGIN SMOKE TEST SUITE")
        print(f"📍 Project: {self.project_root}")
        print(f"⏰ Started: {datetime.now().isoformat()}")
        print("=" * 60)

        tests = [
            ("Plugin Structure", self.test_plugin_structure),
            ("Plugin Manifest", self.test_plugin_json_valid),
            ("No Absolute Paths", self.test_no_absolute_paths),
            ("State Isolation Config", self.test_state_isolation),
            ("Research Output Structure", self.test_research_output_structure),
            ("No Shared State Pollution", self.test_no_shared_state_pollution),
            ("Routing Policy", self.test_routing_policy_documented),
        ]

        for name, test_func in tests:
            try:
                test_func()
            except Exception as e:
                self.log(f"{name} (exception)", False, str(e))

        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"  Total Tests: {self.passed + self.failed}")
        print(f"  ✅ Passed: {self.passed}")
        print(f"  ❌ Failed: {self.failed}")
        print(f"  ⏱️  Finished: {datetime.now().isoformat()}")

        status = "PASS" if self.failed == 0 else "FAIL"
        print(f"\n  🎯 OVERALL: {status}")
        print("=" * 60)

        return {
            "project": str(self.project_root),
            "timestamp": datetime.now().isoformat(),
            "total": self.passed + self.failed,
            "passed": self.passed,
            "failed": self.failed,
            "status": status,
            "results": self.results
        }


def main():
    """Main entry point"""
    # Allow project root to be passed as argument
    if len(sys.argv) > 1:
        project_root = sys.argv[1]
    else:
        # Default to current directory
        project_root = "."

    # Ensure .claude-plugin exists
    plugin_path = Path(project_root) / ".claude-plugin"
    if not plugin_path.exists():
        print(f"❌ No .claude-plugin directory found in {project_root}")
        print("   This doesn't appear to be a plugin-installed project")
        sys.exit(1)

    # Run tests
    tester = PluginSmokeTest(project_root)
    results = tester.run_all_tests()

    # Write results to file
    output_dir = Path(project_root) / ".claude" / "state"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_file = output_dir / "smoke-test-results.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\n📄 Results written to: {output_file}")

    # Exit with appropriate code
    sys.exit(0 if results["status"] == "PASS" else 1)


if __name__ == "__main__":
    main()
