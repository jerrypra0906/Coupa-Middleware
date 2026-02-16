## Coupa Contract ↔ SAP Outline Agreement Integration – Technical Design

### 1. Purpose

This document describes the middleware behaviour for integrating **Coupa Contracts (Outline Agreements)** with **SAP S/4HANA Outline Agreements (OA)**.  
It complements the functional document `INT.01.04.01 - Coupa Contract Integration ver 0.3` and focuses on the middleware’s technical responsibilities, flows, and data handling.

---

### 2. High-Level Business Flow

1. Contract (Outline Agreement) is created and approved in Coupa.
2. When a contract reaches **status = Completed** and **type = Outline Agreement**, Coupa drops:
   - A **Contract Header** CSV file.
   - A **Supplier Item (Contract Item)** CSV file.  
   These are stored on Coupa sFTP in dedicated folders.
3. The middleware:
   - Retrieves the CSV files from sFTP.
   - Loads them into **custom middleware tables** for Contract Header and Supplier Items.
4. For **new Outline Agreements** (no SAP OA exists yet):
   - Middleware validates completeness of Contract + Supplier Item data.
   - Marks records as **Ready to Create SAP OA**.
   - SAP interface program reads these records and creates SAP Outline Agreements.
   - Middleware updates custom tables with **SAP Contract Number** and **SAP Contract Line Number**.
   - Middleware calls **Coupa APIs** to:
     - Update Supplier Items with the SAP OA Line.
     - Publish the contract and update SAP OA number at header level.
5. For **updates to existing Outline Agreements**:
   - Middleware flags records as **Ready to Update SAP OA**.
   - SAP interface updates OA and line items.
   - Middleware marks the update as finished and syncs changes back to Coupa via API.

---

### 3. Technical Flows

#### 3.1 File Retrieval & Staging

- **Source**: Coupa sFTP.
- **Conditions for pickup**:
  - `status = Completed`
  - `type = Outline Agreement`
- **Files**:
  - Contract Header CSV.
  - Supplier Item CSV.
- **Middleware actions**:
  - Download CSVs from sFTP.
  - Parse and validate basic structure (headers, mandatory columns).
  - Store into:
    - `CONTRACT_HEADER_CUSTOM` (logical name).
    - `SUPPLIER_ITEM_CUSTOM` (logical name).
- **Index keys**:
  - Contract Header: `Contract ID`.
  - Supplier Item: `(Contract ID, Coupa Supplier Internal Number (CSIN))`.

#### 3.2 New Contract Creation Flow (parent_number blank)

**Step 1 – Middleware Validation**

- Middleware validates that **Contract Number** exists consistently in:
  - Contract Header CSV vs Contract Header custom table.
  - Supplier Item CSV vs Supplier Item custom table.
- If consistent:
  - Set `Ready_to_Create_SAP_OA = "Yes"` in **both** custom tables.
- If inconsistent:
  - Set `Ready_to_Create_SAP_OA = "No"` and log validation error.

**Step 2 – SAP Interface Selection**

- SAP interface program selects records from custom table where:
  - `Ready_to_Create_SAP_OA = "Yes"`
  - `SAP OA Number` is blank.
- For each eligible contract:
  - SAP creates Outline Agreement and lines.

**Step 3 – Post SAP OA Creation (Middleware)**

- On successful creation:
  - Update Contract Header custom table:
    - `SAP Contract Number`.
  - Update Supplier Item custom table:
    - `SAP Contract Number`.
    - `SAP Contract Line Number`.
    - Derived **SAP OA** (e.g. `SAP Contract Number` + "/" + `SAP Contract Line Number`).

**Step 4 – API Calls to Coupa (Supplier Items)**

- For each Supplier Item row, middleware calls:

  - **Endpoint**  
    `PUT https://kpn-test.coupahost.com/api/supplier_items/(CSIN)`

  - **Body** (update SAP OA Line):
    ```json
    {
      "id": "(CSIN)",
      "custom-fields": {
        "sap-oa-line": "(SAP_OA_LINE)"
      }
    }
    ```

  - `CSIN` and `SAP_OA_LINE` are sourced from the Supplier Item custom table.

**Step 5 – API Calls to Coupa (Contract Header)**

Two sequential `PUT` calls with ~3 seconds delay between them:

1. **Publish Contract**

   - **Endpoint**  
     `PUT https://kpn-test.coupahost.com/api/contracts/(Contract ID)`

   - **Body**:
     ```json
     {
       "id": "(Contract ID)",
       "status": "published"
     }
     ```

2. **Update SAP OA Number**

   - **Endpoint**  
     `PUT https://kpn-test.coupahost.com/api/contracts/(Contract ID)`

   - **Body**:
     ```json
     {
       "id": "(Contract ID)",
       "custom-fields": {
         "sap-oa": "(SAP_OA_NUMBER)"
       }
     }
     ```

   - `SAP_OA_NUMBER` is from the Contract Header custom table.

---

#### 3.3 Contract Update Flow (parent_number not blank)

**Step 1 – Staging & Flagging**

- After loading Contract Header into the custom table, middleware sets:
  - `Ready_to_Update_SAP_OA = "Yes"` for relevant records.

**Step 2 – SAP Interface Selection**

- SAP interface program selects records where:
  - `Ready_to_Update_SAP_OA = "Yes"`.
- It updates existing SAP Outline Agreements (header and/or line items).

**Step 3 – Post SAP OA Update (Middleware)**

- On successful SAP update:
  - Middleware marks `Finished_Update_SAP_OA = "Yes"` in the custom table.

**Step 4 – PUT API Calls to Coupa (Contract Header)**

- Middleware calls:

  - **Endpoint**  
    `PUT https://kpn-test.coupahost.com/api/contracts/(Contract ID)`

  - **Body**:
    ```json
    {
      "id": "(Contract ID)",
      "status": "published"
    }
    ```

  - `Contract ID` is sourced from the Contract Header custom table.

---

#### 3.4 Supplier Item Update Logic

**Decision logic based on `SAP OA Line` and `SAP OA #`:**

- If **`SAP OA Line` is blank**:
  - Check `SAP OA #` in Contract Header table:
    - If `SAP OA #` is blank → trigger **SAP OA Creation**.
    - If `SAP OA #` is present → trigger **SAP OA Update** and **add new items**.
- If **`SAP OA Line` is not blank**:
  - Trigger **SAP OA Update** using existing line information.

**Post-Update Middleware Handling**

- After SAP updates the OA:
  - Middleware sets `Finished_Update_SAP_OA = "Yes"` for affected records.

**PUT API to Coupa – Supplier Items**

- **Endpoint**  
  `PUT https://kpn-test.coupahost.com/api/supplier_items/(CSIN)`

- **Body**:
  ```json
  {
    "id": "(CSIN)",
    "custom-fields": {
      "sap-oa-line": "(SAP_OA_LINE)"
    }
  }
  ```

- `CSIN` and `SAP_OA_LINE` are taken from Supplier Item custom table.

---

### 4. Data Mapping Overview

The original functional spec (`INT.01.04.01 - Coupa Contract Integration ver 0.3`) defines detailed mapping tables:

- **Table 1** – Mapping for **Contract Header** (SAP ↔ Middleware ↔ Coupa).
- **Table 2** – Mapping for **Contract Item / Supplier Item**.
- **Table 3** – Integration technical details / parameters.

In the middleware implementation:

- Contract Header mapping drives:
  - Population of the Contract Header custom table.
  - Fields used for SAP OA creation/update and Coupa Contract header API calls.
- Supplier Item mapping drives:
  - Population of the Supplier Item custom table.
  - Fields used for OA line creation/update and Coupa Supplier Item API calls.

Field-level mapping should be implemented in the **transformation layer** (e.g., transformation service or mapping functions) in a way that:

- Clearly separates **transport** (CSV/API) from **business mapping**.
- Allows for changes to Coupa or SAP fields without changing core engine logic.

---

### 5. Integration & Error Handling Considerations

- **Idempotency**:
  - Contract and Supplier Item records must be uniquely identified by `(Contract ID, CSIN)` and/or SAP OA keys to avoid duplicate OA creation.
- **Retries**:
  - Failed API calls to Coupa (Contract or Supplier Items) should:
    - Log the failure with payload and response.
    - Support retry via the existing retry mechanism in the middleware.
- **Status Tracking**:
  - Use fields such as:
    - `Ready_to_Create_SAP_OA`
    - `Ready_to_Update_SAP_OA`
    - `Finished_Update_SAP_OA`
  - to drive SAP interface selection and prevent re-processing.
- **Logging**:
  - Each step (file retrieval, staging, SAP call, Coupa API call) should write to `INTEGRATION_LOG` and, on failure, to `INTEGRATION_ERROR_DETAIL`.

---

### 6. Testing (High-Level)

Example scenarios derived from the functional spec:

- New contract with **Completed** status and valid data:
  - OA created in SAP, contract published in Coupa, SAP OA & lines synced back.
- New contract with inconsistent Contract Number between header and supplier items:
  - Marked as `Ready_to_Create_SAP_OA = "No"`, errors logged, no SAP call.
- Update of existing contract (with `parent_number` filled):
  - OA updated in SAP, contract re-published in Coupa, OA lines refreshed.
- Supplier Item with missing `CSIN` or invalid SAP OA Line:
  - Rejected by middleware, error logged for correction.

For detailed test cases, align with section **“Test Scenarios”** in the original functional document.


