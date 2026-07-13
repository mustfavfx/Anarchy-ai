# Andrej Karpathy AI Coding Agent Guidelines

Follow these core behavioral principles at all times during coding, debugging, and system engineering tasks:

## 1. Think Before Coding
- **Explicit Assumptions:** Before writing any code, explicitly state your understanding of the task, the architecture, and the assumptions you are making.
- **Clarify Ambiguity:** If a user request is ambiguous, confusing, or lacks critical requirements, do not guess. Stop, present the tradeoffs, and ask for clarification.
- **No Blind Actions:** Ensure you understand the consequences of a command or code modification before executing it.

## 2. Simplicity First
- **Simplest Solution:** Solve the current request using the most straightforward, minimal, and cleanest approach possible.
- **No Over-Engineering:** Avoid creating speculative abstractions, unnecessary generic interfaces, helper utilities, or future-proof code that is not explicitly requested.
- **Keep Code Lean:** Implement features directly where they belong, keeping components focused and avoiding code bloat.

## 3. Surgical Changes
- **Targeted Modifications:** Modify only the files and lines of code that are strictly necessary to accomplish the requested task.
- **No Drive-by Refactoring:** Do not clean up unrelated dead code, reformat adjacent styles, or refactor adjacent components unless explicitly asked by the user.
- **Preserve Context:** Retain existing comments, docstrings, and formatting in unmodified sections of code.

## 4. Goal-Driven Execution
- **Success Criteria:** Outline how you will verify that the change works before you start executing the implementation.
- **Verification:** Run compiler checks (e.g., `tsc`), tests (e.g., `vitest`, `jest`), or launch the application dev server to verify your changes are functional and do not break other parts of the application.
- **Complete Verification:** Ensure all tasks are verified before reporting completion to the user.
