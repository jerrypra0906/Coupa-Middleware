## Contract Header CSV ↔ Middleware Mapping

This mapping is derived from `Contract Header Mapping.xlsx` and shows how each **CSV column** maps to the **middleware staging fields** in `contract_header_staging`.

| CSV Field Name                       | Middleware-Field Name | Middleware-Field Type | Notes                                  |
|--------------------------------------|------------------------|------------------------|----------------------------------------|
| SAP OA                               | ebeln                  | String(255)            | SAP Outline Agreement number           |
| Contract Name                        | ctr_name               | String(255)            | Coupa Contract Name                    |
| Contract #                           | ctr_num                | String(255)            | Contract Number                        |
| ID                                   | ctr_id                 | Integer                | Coupa Contract ID                      |
| contract_type name                   | ctr_type               | String(10)             | Contract Type                          |
| Status                               | ctr_stat               | String(20)             | Contract Status                        |
| Owner Login                          | own_login              | String(50)             | Owner Login                            |
| contract-detail-commodity-name       | comm_name              | String(50)             | Commodity Name                         |
| Created Date                         | ctr_cdat               | Date                   | Contract Created Date                  |
| Supplier Number                      | lifnr                  | Integer                | Supplier Site Number                   |
| Supplier                             | lfa1_name1             | String(255)            | Supplier Name                          |
| purchasing_group external_ref_code   | ekgrp                  | String(100)            | Purchasing Group                       |
| Starts                               | kdatb                  | Date                   | Contract Start Date                    |
| Content Groups                       | ekorg                  | String(255)            | Content Groups                         |
| Expires                              | kdate                  | Date                   | Contract Expiry Date                   |
| Created By Login                     | ctr_clog               | Integer                | Created By Login                       |
| Currency Code                        | waers                  | String(3)              | Currency Code                          |
| payment_term code                    | zterm                  | String(4)              | Payment Term                           |
| shipping_term code                   | inco1                  | String(3)              | Shipping Term                          |
| maximum_value                        | ktwrt                  | Integer                | Maximum Spend                          |
| Updated Date                         | ctr_updt               | Date                   | Last Updated Date                      |
| item_category                        | ekpo_pstyp             | String(10)             | Item Category                          |
| company_code external_ref_code       | bukrs                  | String(50)             | Company Code                           |
| *(none / internal flag)*            | crt_sapoa              | String(10)             | Ready to Create SAP OA (Y/N or code)  |
| *(none / internal flag)*            | upd_sapoa              | String(10)             | Ready to Update SAP OA (Y/N or code)  |
| amended_contract_type                | amd_ctr_ty             | String(10)             | Amendment Contract Type                |
| parent id                            | ctrpa_id               | Integer                | Parent Contract ID                     |
| parent name                          | ctrpa_name             | String(255)            | Parent Contract Name                   |
| parent number                        | ctrpa_num              | String(255)            | Parent Contract Number                 |

The `contract_header_staging` table also retains internal control fields (`contract_id`, `contract_number`, `status`, `ready_to_create_sap_oa`, `ready_to_update_sap_oa`, `finished_update_sap_oa`, `sap_oa_number`, timestamps) used by the middleware for processing and orchestration.


