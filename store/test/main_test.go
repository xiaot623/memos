package test

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

func TestMain(m *testing.M) {
	// If DRIVER is set, run tests for that driver only
	if os.Getenv("DRIVER") != "" {
		defer TerminateContainers()
		os.Exit(m.Run())
		return
	}

	// -count=0 (and -c) only need packages to compile; skip the multi-driver reexec.
	if testingCompileOnly() {
		os.Exit(m.Run())
		return
	}

	// No DRIVER set - run tests for all drivers sequentially
	runAllDrivers()
}

func testingCompileOnly() bool {
	for i, arg := range os.Args {
		if arg == "-test.count=0" || arg == "-count=0" {
			return true
		}
		if (arg == "-test.count" || arg == "-count") && i+1 < len(os.Args) && os.Args[i+1] == "0" {
			return true
		}
	}
	return false
}

func runAllDrivers() {
	// Each run names a driver and the extra environment it needs.
	runs := []struct {
		label string
		env   []string
	}{
		{"sqlite", []string{"DRIVER=sqlite"}},
	}
	_, currentFile, _, _ := runtime.Caller(0)
	projectRoot := filepath.Dir(filepath.Dir(filepath.Dir(currentFile)))

	var failed []string
	for _, run := range runs {
		fmt.Printf("\n==================== %s ====================\n\n", run.label)

		cmd := exec.Command("go", "test", "-v", "-count=1", "./store/test/...")
		cmd.Dir = projectRoot
		env := append(os.Environ(), run.env...)
		cmd.Env = env
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		if err := cmd.Run(); err != nil {
			failed = append(failed, run.label)
		}
	}

	fmt.Println()
	if len(failed) > 0 {
		fmt.Printf("FAIL: %v\n", failed)
		panic("some drivers failed")
	}
	fmt.Println("PASS: all drivers")
}
