package com.anupam.mcp.server.service;

import com.anupam.mcp.server.model.Invoice;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Parses Excel files containing invoice data into {@link com.anupam.mcp.server.model.Invoice} objects.
 *
 * <p>Uses Apache POI to read the first sheet and map rows to invoice fields.</p>
 *
 * @author Anupam Sharma
 * @since 1.0
 */
@Service
public class ExcelParser {
    private static final Logger LOG = LoggerFactory.getLogger(ExcelParser.class);

    /**
     * Parses the given Excel input stream into a list of invoices.
     *
     * @param inputStream input stream of an XLSX workbook
     * @return list of parsed invoices; empty if parsing fails
     */
    public List<Invoice> parseInvoices(InputStream inputStream) {
        List<Invoice> invoices = new ArrayList<>();
        
        try (Workbook workbook = new XSSFWorkbook(inputStream)) {
            Sheet sheet = workbook.getSheetAt(0);
            LOG.info("📊 Parsing Excel file: {} rows found (including header)", sheet.getLastRowNum() + 1);
            
            // Skip header row
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row != null) {
                    LOG.debug("Processing row {}", i);
                    Invoice invoice = parseRow(row);
                    if (invoice != null) {
                        invoices.add(invoice);
                        LOG.info("✅ Row {} parsed successfully", i);
                    } else {
                        LOG.warn("❌ Row {} skipped - validation failed", i);
                    }
                } else {
                    LOG.debug("Row {} is null, skipping", i);
                }
            }
            LOG.info("✅ Successfully parsed {} invoices from {} data rows", invoices.size(), sheet.getLastRowNum());
        } catch (Exception e) {
            LOG.error("❌ Error parsing Excel file: {}", e.getMessage(), e);
        }
        
        return invoices;
    }

    /**
     * Parses a single row into an invoice instance.
     * Expected columns: Invoice Number, Vendor, Vendor Code, Service, Date, Total Amount, Description
     *
     * @param row Excel row
     * @return the parsed invoice, or null if the row is invalid
     */
    private Invoice parseRow(Row row) {
        try {
            LOG.debug("Parsing row {}: Reading cells...", row.getRowNum());
            
            String invoiceNumber = getCellValueAsString(row.getCell(0));
            String vendor = getCellValueAsString(row.getCell(1));
            String vendorCode = getCellValueAsString(row.getCell(2));
            String service = getCellValueAsString(row.getCell(3));
            LocalDate date = getCellValueAsDate(row.getCell(4));
            BigDecimal totalAmount = getCellValueAsBigDecimal(row.getCell(5));
            String description = getCellValueAsString(row.getCell(6));

            LOG.debug("Row {} values: invoiceNum={}, vendor={}, vendorCode={}, service={}, date={}, amount={}, desc={}",
                    row.getRowNum(), invoiceNumber, vendor, vendorCode, service, date, totalAmount, description);

            // Validate required fields
            if (!isValidInvoice(invoiceNumber, vendor, vendorCode, service, date, totalAmount, description)) {
                LOG.warn("❌ Row {} rejected: Missing required invoice fields", row.getRowNum());
                return null;
            }

            LOG.info("✅ Parsed invoice: num={}, vendor={}, vendorCode={}, service={}, date={}, amount={}, desc={}", 
                invoiceNumber, vendor, vendorCode, service, date, totalAmount, description);
            return new Invoice(invoiceNumber, vendor, vendorCode, service, date, totalAmount, description);
        } catch (Exception e) {
            LOG.error("❌ Error parsing row {}: {}", row.getRowNum(), e.getMessage(), e);
            return null;
        }
    }

    /**
     * Validates if parsed data contains all required invoice fields.
     * Centralized validation logic - easy to extend with more rules.
     *
     * @return true if valid invoice, false otherwise
     */
    private boolean isValidInvoice(String invoiceNumber, String vendor, String vendorCode, 
                                   String service, LocalDate date, BigDecimal totalAmount, 
                                   String description) {
        // Required fields validation
        if (invoiceNumber == null || invoiceNumber.trim().isEmpty()) {
            LOG.warn("❌ Validation failed: Missing invoice number");
            return false;
        }
        if (vendor == null || vendor.trim().isEmpty()) {
            LOG.warn("❌ Validation failed: Missing vendor");
            return false;
        }
        if (vendorCode == null || vendorCode.trim().isEmpty()) {
            LOG.warn("❌ Validation failed: Missing vendor code");
            return false;
        }
        if (service == null || service.trim().isEmpty()) {
            LOG.warn("❌ Validation failed: Missing service");
            return false;
        }
        if (date == null) {
            LOG.warn("❌ Validation failed: Missing date");
            return false;
        }
        if (totalAmount == null || totalAmount.compareTo(BigDecimal.ZERO) <= 0) {
            LOG.warn("❌ Validation failed: Missing or invalid total amount (value={})", totalAmount);
            return false;
        }
        
        LOG.debug("✅ All required fields present and valid");
        return true;
    }

    /**
     * Reads the cell value as a string.
     *
     * @param cell Excel cell
     * @return string representation or null
     */
    private String getCellValueAsString(Cell cell) {
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> String.valueOf(cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> null;
        };
    }

    /**
     * Reads the cell value as a date.
     *
     * @param cell Excel cell
     * @return local date value or null
     */
    private LocalDate getCellValueAsDate(Cell cell) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getDateCellValue().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        if (cell.getCellType() == CellType.STRING) {
            String dateStr = cell.getStringCellValue();
            // Try common date formats
            String[] formats = {"MM/dd/yyyy", "yyyy-MM-dd", "dd/MM/yyyy", "M/d/yyyy"};
            for (String format : formats) {
                try {
                    return LocalDate.parse(dateStr, java.time.format.DateTimeFormatter.ofPattern(format));
                } catch (Exception ignored) {}
            }
            LOG.debug("Could not parse date from string: {}", dateStr);
        }
        return null;
    }

    /**
     * Reads the cell value as a {@link java.math.BigDecimal}.
     *
     * @param cell Excel cell
     * @return numeric value or null
     */
    private BigDecimal getCellValueAsBigDecimal(Cell cell) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) {
            return BigDecimal.valueOf(cell.getNumericCellValue());
        }
        if (cell.getCellType() == CellType.STRING) {
            try {
                return new BigDecimal(cell.getStringCellValue().replaceAll("[^0-9.\\-]", ""));
            } catch (Exception e) {
                LOG.debug("Could not parse amount from string: {}", cell.getStringCellValue());
            }
        }
        return null;
    }
}