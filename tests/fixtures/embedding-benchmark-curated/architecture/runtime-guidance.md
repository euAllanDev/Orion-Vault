# Runtime Guidance

## Vocabulary Pressure

Teams often discuss software design layers, modular boundaries, separation of concerns, framework isolation, and adapter vocabulary long before they align on how the runtime should actually behave. That language is useful, but by itself it can hide the operational question that matters most: where business policy lives and how execution crosses the boundary between stable rules and replaceable delivery details.

## Runtime Flow

Use cases coordinate domain rules while transport, storage, and framework mechanics stay outside the business core. The application flow enters through a thin adapter, calls a use case, evaluates business policy in the domain model, and only afterwards delegates side effects to outer components. This is the section that matters when the question is how to keep business policy independent from transport and storage details during real execution.

## Delivery Boundary

Adapters remain at the edges, infrastructure is replaceable, and the runtime boundary is preserved by forcing external tools to depend on application contracts instead of the reverse. A delivery mechanism may change from HTTP to CLI, or from one database to another, without rewriting the policy that decides what the system must do.

## Failure Mode

The architecture becomes brittle when framework code starts deciding business rules, when persistence concerns leak into use case orchestration, or when developers treat layering vocabulary as a substitute for explicit runtime boundaries. The point of this note is not naming alone; it is preserving the flow that keeps the business core stable.
