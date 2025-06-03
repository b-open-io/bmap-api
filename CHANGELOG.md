# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.9] - 2025-06-03

### Fixed
- **Package Manager Cleanup**: Removed conflicting `package-lock.json` file since project uses bun
- **MongoDB ObjectId Validation**: Enhanced error handling in `getBAPIdentites()` and `getBAPAddresses()` to filter invalid ObjectId strings
- **Autofill Schema Validation**: Fixed autofill endpoint to return proper array format for posts field
- **Friend Schema Alignment**: Corrected field naming and schema structure for friend relationships
- **Code Quality**: Improved variable naming and removed package-lock.json conflicts

### Added  
- **Package Manager Protection**: Added `package-lock.json` and `yarn.lock` to `.gitignore` to prevent conflicts with bun
- **Enhanced Error Validation**: Better ObjectId validation prevents server crashes from malformed IDs
- **Schema Consistency**: All social endpoints now have proper schema validation

### Changed
- **Breaking**: Updated `FriendResponseSchema` to use separate schemas for different relationship types
- Project consistently uses bun for all package management operations
- Improved error messages for invalid ObjectId inputs

## [0.0.8] - 2025-06-03

### Fixed
- **MongoDB ObjectId Error**: Fixed BSONError in feed endpoint by adding validation to filter invalid ObjectId strings in `getBAPIdentites()` and `getBAPAddresses()` functions
- **Autofill Schema Mismatch**: Fixed validation error in `/social/autofill` endpoint by returning only `results` array instead of full `PostsResponse` object
- **Friend Endpoint Schema Issues**: 
  - Fixed field name mismatch (`bapID` vs `bapId`) in friend response processing
  - Added separate `FriendRequestSchema` for incoming/outgoing arrays (breaking change)
  - Corrected `FriendResponseSchema` to use proper schemas for each array type

### Added
- **Enhanced Schema Validation**: Added `FriendRequestSchema` for proper typing of friend request objects
- **API Error Prevention**: Added ObjectId validation to prevent server crashes from invalid IDs
- **Code Quality**: Shortened variable names (`validIdKeys` → `validIds`) per project style

### Changed
- **Breaking Change**: `FriendResponseSchema.incoming` and `FriendResponseSchema.outgoing` now use `FriendRequestSchema` instead of `FriendSchema`
- Updated friend processing functions to use consistent field naming conventions
- Improved error handling in BAP identity lookup functions

### Technical
- Systematic endpoint validation using our established debugging methodology
- All validation errors resolved through schema-database alignment
- Maintained security-first validation patterns

## [0.0.7] - 2025-06-03

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

## [0.0.6] - 2025-06-03

### Added
- Initial types package release
- BAP identity management
- Social networking features
- Analytics suite
- Real-time messaging capabilities 