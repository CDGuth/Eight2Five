---

description: General-purpose agent for researching complex questions and executing multi-step tasks. Use this agent to execute multiple units of work in parallel.
permission:
  "*": allow
  doom_loop: ask
  external_directory:
    "*": ask
    /home/colin_guth/.local/share/opencode/tool-output/*: allow
    /tmp/opencode/*: allow
    /home/colin_guth/.agents/skills/deprecation-and-migration/*: allow
    /home/colin_guth/.agents/skills/source-driven-development/*: allow
    /home/colin_guth/.agents/skills/docx/*: allow
    /home/colin_guth/.agents/skills/pdf/*: allow
    /home/colin_guth/.agents/skills/pptx/*: allow
    /home/colin_guth/.agents/skills/code-simplification/*: allow
    /home/colin_guth/.agents/skills/api-and-interface-design/*: allow
    /home/colin_guth/.agents/skills/conventional-commit/*: allow
    /home/colin_guth/.agents/skills/ci-cd-and-automation/*: allow
    /home/colin_guth/.agents/skills/context7-mcp/*: allow
    /home/colin_guth/.agents/skills/xlsx/*: allow
    /home/colin_guth/.agents/skills/git-workflow-and-versioning/*: allow
    /home/colin_guth/.agents/skills/security-and-hardening/*: allow
    /home/colin_guth/.agents/skills/find-skills/*: allow
    /home/colin_guth/.agents/skills/shipping-and-launch/*: allow
    /home/colin_guth/.agents/skills/create-pr/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/gluestack-ui-v4/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec/openspec-propose/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec/openspec-onboard/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec/openspec-apply-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec/openspec-archive-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec/openspec-continue-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec/openspec-verify-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec/openspec-bulk-archive-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/context7-mcp/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/shipping-and-launch/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/gluestack-ui-v4/variants/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/gluestack-ui-v4/creating-components/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/gluestack-ui-v4/validation/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/gluestack-ui-v4/components/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/gluestack-ui-v4/styling/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/gluestack-ui-v4/setup/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/gluestack-ui-v4/performance/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/gluestack-ui-v4/migrate-to-v5/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/pdf/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/git-workflow-and-versioning/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/xlsx/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/security-and-hardening/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/create-pr/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/docx/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/api-and-interface-design/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/code-simplification/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/source-driven-development/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/pptx/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/deprecation-and-migration/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/find-skills/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec/openspec-new-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec/openspec-ff-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec/openspec-explore/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec/openspec-sync-specs/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/ci-cd-and-automation/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/general/conventional-commit/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/expo-api-routes/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/expo-deployment/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/building-native-ui/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/upgrading-expo/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/eas-update-insights/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/expo-module/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/expo-ui-swiftui/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/native-data-fetching/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/expo-tailwind-setup/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/expo-dev-client/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/expo-cicd-workflows/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/use-dom/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo/expo-ui-jetpack-compose/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/gluestack-ui-v4/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/expo-api-routes/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/expo-deployment/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/upgrading-expo/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/eas-update-insights/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/expo-module/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/expo-tailwind-setup/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/building-native-ui/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/expo-ui-swiftui/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/native-data-fetching/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/expo-dev-client/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/expo-ui-jetpack-compose/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/expo-cicd-workflows/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo/use-dom/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/gluestack-ui-v4/variants/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/gluestack-ui-v4/migrate-to-v5/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/gluestack-ui-v4/performance/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/gluestack-ui-v4/setup/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/gluestack-ui-v4/styling/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/gluestack-ui-v4/components/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/gluestack-ui-v4/validation/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/gluestack-ui-v4/creating-components/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/source-driven-development/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/deprecation-and-migration/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/pptx/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/pdf/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/find-skills/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/code-simplification/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/conventional-commit/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/api-and-interface-design/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/create-pr/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/docx/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/security-and-hardening/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/xlsx/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/git-workflow-and-versioning/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/ci-cd-and-automation/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/shipping-and-launch/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/general/context7-mcp/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec/openspec-propose/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec/openspec-verify-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec/openspec-continue-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec/openspec-archive-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec/openspec-apply-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec/openspec-onboard/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec/openspec-bulk-archive-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec/openspec-sync-specs/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec/openspec-explore/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec/openspec-new-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec/openspec-ff-change/*: allow
  question: deny
  plan_enter: deny
  plan_exit: deny
  repo_clone: deny
  repo_overview: deny
  read:
    "*.env": ask
    "*.env.*": ask
    "*.env.example": allow
  todowrite: deny
top_p: 0.9
---

---
description: General-purpose agent for parallel implementation or multi-step background tasks. Use this agent to execute multiple units of work in parallel, implement self-contained layers, or any task that can be fully described and handed off.
mode: subagent
permission:
  "*": allow
  doom_loop: ask
  external_directory:
    "*": ask
    /home/colin_guth/.local/share/opencode/tool-output/*: allow
    /tmp/opencode/*: allow
    /home/colin_guth/.agents/skills/code-simplification/*: allow
    /home/colin_guth/.agents/skills/context7-mcp/*: allow
    /home/colin_guth/.agents/skills/pptx/*: allow
    /home/colin_guth/.agents/skills/shipping-and-launch/*: allow
    /home/colin_guth/.agents/skills/git-workflow-and-versioning/*: allow
    /home/colin_guth/.agents/skills/pdf/*: allow
    /home/colin_guth/.agents/skills/security-and-hardening/*: allow
    /home/colin_guth/.agents/skills/api-and-interface-design/*: allow
    /home/colin_guth/.agents/skills/ci-cd-and-automation/*: allow
    /home/colin_guth/.agents/skills/create-pr/*: allow
    /home/colin_guth/.agents/skills/xlsx/*: allow
    /home/colin_guth/.agents/skills/deprecation-and-migration/*: allow
    /home/colin_guth/.agents/skills/find-skills/*: allow
    /home/colin_guth/.agents/skills/docx/*: allow
    /home/colin_guth/.agents/skills/source-driven-development/*: allow
    /home/colin_guth/.agents/skills/conventional-commit/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/source-driven-development/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/pdf/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec-propose/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec-archive-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/pptx/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/code-simplification/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/deprecation-and-migration/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec-continue-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/find-skills/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec-verify-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo-api-routes/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec-apply-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo-deployment/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/building-native-ui/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/upgrading-expo/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/shadcn/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/eas-update-insights/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec-onboard/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo-module/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/conventional-commit/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec-bulk-archive-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo-tailwind-setup/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec-sync-specs/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/api-and-interface-design/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo-ui-swiftui/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/docx/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/create-pr/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/security-and-hardening/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/native-data-fetching/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/xlsx/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec-explore/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec-ff-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/use-dom/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo-ui-jetpack-compose/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/openspec-new-change/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/ci-cd-and-automation/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/git-workflow-and-versioning/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo-dev-client/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/expo-cicd-workflows/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/shipping-and-launch/*: allow
    /home/colin_guth/Eight2Five/.agents/skills/context7-mcp/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/source-driven-development/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/find-skills/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/deprecation-and-migration/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/pptx/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec-propose/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/pdf/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec-verify-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec-continue-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/code-simplification/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec-archive-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo-deployment/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec-apply-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo-api-routes/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/upgrading-expo/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/shadcn/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/eas-update-insights/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec-onboard/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/building-native-ui/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo-module/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/conventional-commit/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo-ui-swiftui/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec-bulk-archive-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/api-and-interface-design/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/docx/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec-sync-specs/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/create-pr/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo-tailwind-setup/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/security-and-hardening/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/native-data-fetching/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/xlsx/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec-explore/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo-dev-client/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/git-workflow-and-versioning/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec-new-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo-ui-jetpack-compose/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/ci-cd-and-automation/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/use-dom/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/openspec-ff-change/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/context7-mcp/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/shipping-and-launch/*: allow
    /home/colin_guth/Eight2Five/.opencode/skills/expo-cicd-workflows/*: allow
  read:
    "*.env": ask
    "*.env.*": ask
    "*.env.example": allow
  plan_enter: deny
    plan_exit: deny
    question: deny
    todowrite: deny
    task: deny
---

You are a general-purpose subagent assisting the primary engineer agent, designed to handle well-scoped implementation tasks.

Your responsibilities:
- Implement self-contained layers (e.g. a data access layer, a set of tests, a migration).
- Run multiple units of work simultaneously when handed off by the engineer.
- Handle any task that can be fully described and executed autonomously.
- Write code, create files, edit files, and create tests, as instructed.

Guidelines:
- *Above all else, follow the instructions of for task delegated to you.*
- Follow the existing project conventions, styles, and architecture.
- Write clean and maintainable code.
- You have the authority to edit, write, and interact directly with the codebase.
- The engineer agent will give you an exact task, relevant file paths, patterns, or information gathered through research, and specify what output they need back. Follow these instructions precisely.
- Report your completion status, the files modified, and any unexpected issues or deviations encountered back to the engineer agent.
- Prefer to focus on implementation, not problem solving. If you encounter an issue that is out of scope for your assigned task (such as lacking necessary documentation) report this to the engineer agent.