# Liiift Sanity Tools - Test Studio

A comprehensive test environment for all 14 Liiift Sanity Tools, providing a unified platform for testing, development, and demonstration of the complete tool suite.

## 🎯 **Purpose**

This test studio serves multiple purposes:

- **Testing Environment**: Verify all 14 tools work correctly
- **Development Platform**: Develop and debug tool functionality
- **Demo Environment**: Showcase the complete tool suite
- **Integration Testing**: Test tools working together

## 🛠️ **Included Tools**

### **Data Management & Operations (6 tools)**

1. **Advanced Reference Array** - Smart search and bulk operations for references
2. **Bulk Data Operations** - Mass updates and batch processing
3. **Convert IDs to Slugs** - Automated slug generation
4. **Convert References** - Reference relationship migration
5. **Export Data** - Multi-format data export
6. **Search and Delete** - Advanced search with safe deletion

### **Content & Asset Management (2 tools)**

7. **Delete Unused Assets** - Storage optimization and cleanup
8. **Duplicate and Rename** - Smart document duplication

### **Typography & Font Management (2 tools)**

9. **Font Data Extractor** - Comprehensive font metadata extraction
10. **Font Management Suite** - Complete foundry management system

### **E-commerce & Business (3 tools)**

11. **Enhanced Commerce** - Complete e-commerce schemas and dashboard
12. **Renewals Authorization** - License renewal management
13. **Sales Portal** - Real-time sales analytics

### **Studio Enhancement (1 tool)**

14. **Studio Utilities** - Master dashboard for all tools

## 📋 **Test Schemas**

The studio includes comprehensive test schemas designed to exercise all tool functionality:

### **Reference Test Documents**

- Complex reference relationships for testing Advanced Reference Array
- Cross-references between different document types
- Single and multi-reference fields

### **Font Test Documents**

- Font file uploads and metadata
- Glyph information and license types
- Designer and foundry information

### **Asset Test Documents**

- Image galleries and file collections
- Various media types (images, videos, documents)
- Asset categorization and tagging

### **Bulk Test Documents**

- Large collections for bulk operations
- Status and priority fields for filtering
- Metadata objects for complex operations

### **E-commerce Schemas**

- Complete cart, order, and customer schemas
- Discount codes and pricing structures
- Sales data for analytics testing

## 🚀 **Quick Start**

### **Prerequisites**

- Node.js 18+
- Sanity CLI installed globally: `npm install -g @sanity/cli`

### **Setup**

1. **Install Dependencies**

   ```bash
   cd test-studio
   npm install
   ```

2. **Configure Sanity Project** (REQUIRED)
   - Copy the environment example file:
     ```bash
     cp .env.example .env.local
     ```
   - Update `.env.local` with your actual Sanity project details:

     ```bash
     # Get your project ID from https://sanity.io/manage
     SANITY_STUDIO_PROJECT_ID=your-actual-project-id
     SANITY_STUDIO_DATASET=production
     ```

   - Or create a new Sanity project:

     ```bash
     # Install Sanity CLI if not already installed
     npm install -g @sanity/cli

     # Create new project
     sanity init

     # Use the project ID from the init process
     ```

3. **Start Development Server**

   ```bash
   npm run dev
   ```

4. **Access Studio**
   - Open browser to `http://localhost:3333`
   - Navigate to Tools menu to access all utilities
   - **Note**: Studio will not load without proper project configuration

## 🧪 **Testing Guide**

### **Tool-by-Tool Testing**

#### **Data Management Tools**

1. **Advanced Reference Array**:
   - Create Reference Test documents
   - Use the enhanced reference array field
   - Test search, bulk operations, and filtering

2. **Bulk Data Operations**:
   - Create multiple Bulk Test documents
   - Access Tools → Bulk Data Operations
   - Test mass updates and batch processing

3. **Convert IDs to Slugs**:
   - Create documents without slugs
   - Use Tools → Convert IDs to Slugs
   - Verify slug generation

#### **E-commerce Tools**

1. **Enhanced Commerce**:
   - Access Tools → Enhanced Commerce
   - Test cart creation and order management
   - Verify pricing calculations

2. **Sales Portal**:
   - Access Tools → Sales Portal (plugin)
   - View analytics dashboard
   - Test summary cards and metrics

### **Integration Testing**

#### **Cross-Tool Workflows**

1. **Content Migration**:
   - Create reference relationships
   - Use Convert References to migrate
   - Verify with Advanced Reference Array

2. **Asset Management**:
   - Upload various media files
   - Test Delete Unused Assets
   - Verify cleanup accuracy

## 📊 **Development Features**

### **Hot Reloading**

- All tools load from local source directories
- Changes to tool code reflect immediately
- TypeScript compilation and error checking

### **Debugging Support**

- Console logging enabled in development
- Error boundaries for tool isolation
- Performance monitoring

### **Vision Integration**

- GROQ testing with Vision tool
- Query development and testing
- Schema exploration

## 🔧 **Configuration**

### **Adding New Tools**

1. Import the tool component in `sanity.config.ts`
2. Add to the `tools` array with proper configuration
3. Include any required schemas in the schema types

### **Custom Schemas**

- Add new test schemas in `schemas/` directory
- Export from `schemas/index.ts`
- Reference in other schemas for relationships

### **Environment Configuration**

- Development vs production settings
- Custom base paths
- Plugin-specific configurations

## 📈 **Performance Testing**

### **Load Testing**

- Create large datasets (100+ documents)
- Test bulk operations performance
- Monitor memory usage during operations

### **Concurrent Usage**

- Multiple tool instances
- Simultaneous operations
- Resource sharing verification

## 🐛 **Troubleshooting**

### **Common Issues**

1. **Import Errors**: Ensure all tool directories exist and have proper exports
2. **Schema Conflicts**: Check for naming conflicts between test schemas
3. **Tool Loading**: Verify component exports match configuration

### **Development Tips**

- Use browser dev tools for debugging
- Check Sanity Studio console for errors
- Monitor network requests for API calls

## 📝 **Contributing**

### **Adding Test Cases**

1. Create comprehensive test scenarios
2. Document expected behavior
3. Add edge cases and error conditions

### **Schema Enhancement**

- Add fields that exercise tool features
- Create complex relationships
- Include validation rules

## 🎊 **Success Metrics**

A successful test session should verify:

- ✅ All 14 tools load without errors
- ✅ Each tool performs its core functions
- ✅ Tools work together without conflicts
- ✅ Performance remains acceptable under load
- ✅ UI remains responsive during operations

## 🔗 **Related Resources**

- **Main Repository**: [Liiift Sanity Tools](https://github.com/over-punch/liiift-sanity-tools)
- **Individual Tool Documentation**: See each tool's README
- **Sanity Documentation**: [sanity.io/docs](https://sanity.io/docs)

---

**Built with ❤️ for comprehensive Sanity Studio tool testing**

_Ready to test all 14 production-ready tools in one integrated environment!_
