# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed validation errors in BAP identity endpoints by making `txId` field optional in `AddressEntrySchema`
- Corrected database field mapping from `txid` (database) to `txId` (API) in BAP identity functions
- Security fix: Default signature validation to false - only true if explicitly validated
- Fixed header overwriting issue in Elysia middleware by using `Object.assign()` instead of direct assignment
- Implemented clean validation error messages replacing verbose JSON with targeted field-specific messages

### Added
- Enhanced error handler with validation error formatting in `middleware/errorHandler.ts`
- Comprehensive debugging methodology documentation in `CLAUDE.md`
- Database architecture and direct access patterns documentation
- TypeScript and Elysia-specific debugging guidance
- MessageMeta backend functionality with reaction counting
- `MessagesResponseSchema` for proper message response validation

### Changed
- Updated `AddressEntrySchema` to make `txId` optional to match database reality
- Improved `getSigners()`, `getBAPIdentites()`, and `searchIdentities()` functions with proper field mapping
- Enhanced error handling across social endpoints with proper status codes

### Technical
- Added database field mapping documentation and best practices
- Documented MongoDB direct access patterns for efficient debugging
- Established schema-first development methodology
- Implemented security-first validation patterns

## [0.0.6] - 2024-12-XX

### Added
- Initial types package release
- BAP identity management
- Social networking features
- Analytics suite
- Real-time messaging capabilities 