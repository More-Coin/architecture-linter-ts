import type { ArchitectureFile } from "../../ValueObjects/ArchitectureFile.ts";
import type { SourceCoordinate } from "../../ValueObjects/SourceCoordinate.ts";

/**
 * Flat occurrence of a referenced *type name* somewhere on a file's surface.
 *
 * Mirrors Swift's `CleanTypeOccurrence` from `CleanArchitectureBoundaryPolicies.swift`.
 * The TS translation enumerates the same eight surfaces Swift walks:
 *
 *   1. `file.typeReferences`              — explicit type references
 *   2. `file.storedMemberDeclarations`    — stored property/parameter-property types
 *   3. `file.constructorDeclarations`     — constructor parameter types
 *   4. `file.methodDeclarations`          — method parameter types and return types
 *   5. `file.computedPropertyDeclarations` — getter/computed property types
 *   6. `file.constructionOccurrences`     — `new Foo(...)` call sites
 *   7. `file.staticMemberAccessOccurrences` — non-call `Foo.bar` accesses (base name only)
 *   8. `file.memberCallOccurrences` — member calls such as `Foo.bar()` (base name only)
 *
 * Each occurrence carries the canonicalized type name and a precise coordinate.
 * Names are deduplicated within the file but every duplicate produces a
 * coordinate (the iterator can be filtered by callers that want one-per-name).
 */
export interface CleanTypeOccurrence {
  readonly name: string;
  readonly coordinate: SourceCoordinate;
}

/**
 * Yield every type-name occurrence on the file's surface in source order.
 * Per-name deduplication is the caller's responsibility — most reference
 * policies in Swift emit one diagnostic per unique name, but a few (e.g.
 * `application.services.usecase_construction`) want every coordinate.
 */
export function* iterateReferenceOccurrences(
  file: ArchitectureFile,
): Generator<CleanTypeOccurrence> {
  for (const reference of file.typeReferences) {
    yield {
      name: canonicalReferenceTypeName(reference.name),
      coordinate: reference.coordinate,
    };
  }

  for (const member of file.storedMemberDeclarations) {
    for (const typeName of member.typeNames) {
      yield {
        name: canonicalReferenceTypeName(typeName),
        coordinate: member.coordinate,
      };
    }
  }

  for (const constructorDeclaration of file.constructorDeclarations) {
    for (const typeName of constructorDeclaration.parameterTypeNames) {
      yield {
        name: canonicalReferenceTypeName(typeName),
        coordinate: constructorDeclaration.coordinate,
      };
    }
  }

  for (const method of file.methodDeclarations) {
    for (const typeName of method.parameterTypeNames) {
      yield {
        name: canonicalReferenceTypeName(typeName),
        coordinate: method.coordinate,
      };
    }
    for (const typeName of method.returnTypeNames) {
      yield {
        name: canonicalReferenceTypeName(typeName),
        coordinate: method.coordinate,
      };
    }
  }

  for (const computed of file.computedPropertyDeclarations) {
    for (const typeName of computed.typeNames) {
      yield {
        name: canonicalReferenceTypeName(typeName),
        coordinate: computed.coordinate,
      };
    }
  }

  for (const construction of file.constructionOccurrences) {
    yield {
      name: canonicalReferenceTypeName(construction.typeName),
      coordinate: construction.coordinate,
    };
  }

  for (const staticAccess of file.staticMemberAccessOccurrences) {
    yield {
      name: canonicalReferenceTypeName(staticAccess.baseName),
      coordinate: staticAccess.coordinate,
    };
  }

  for (const memberCall of file.memberCallOccurrences) {
    yield {
      name: canonicalReferenceTypeName(memberCall.baseName),
      coordinate: memberCall.coordinate,
    };
  }
}

/**
 * Mirrors Swift's `canonicalCleanTypeName`: strip TS optional/nullable
 * markers, leading `any `/`some ` (defensive — TS doesn't use them but
 * existing extractor output may include union/optional markers).
 */
export function canonicalReferenceTypeName(name: string): string {
  return name
    .replace(/^any\s+/, "")
    .replace(/^some\s+/, "")
    .replace(/\?/g, "")
    .replace(/!/g, "")
    .trim();
}
