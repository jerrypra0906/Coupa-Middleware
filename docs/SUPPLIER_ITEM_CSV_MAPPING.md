## Supplier Item CSV ↔ Middleware Mapping

Derived from `Supplier Item Staging.xlsx`, this table maps each **CSV column** to the corresponding **middleware field** in `supplier_item_staging`.

| CSV Field Name                 | Middleware-Field Name | Middleware-Field Type  | Notes                                   |
|--------------------------------|------------------------|------------------------|-----------------------------------------|
| Contract number               | ctm_cnum              | String(255)            | Contract Number                         |
| *(none)*                       | ebeln                 | String(10)             | SAP Contract Number                     |
| *(none)*                       | ebelp                 | String(10)             | SAP Contract Line Number                |
| SAP OA Line#                  | sap_oa_line           | String(20)             | SAP Contract No/Line No                 |
| Name                          | ctm_name              | String(255)            | Item Name                               |
| Supplier Part Num             | ctm_plant             | String(255)            | Plant / Supplier Part Num               |
| Supplier Aux Part Num         | sup_apnm              | String(255)            | Supplier Aux Part Num                   |
| Description                   | ctm_desc              | String(255)            | Description                             |
| Item Number                   | ekpo_matnr            | String(255)            | Item Commodity SAP Code / Item Number   |
| UOM Code                      | ekpo_meins            | String(50)             | UOM Code                                |
| *(Price column)*              | ekpo_netpr            | decimal(30,3)          | Price                                   |
| Price Per                     | price_per             | decimal(30,3)          | Price Per                               |
| Price                         | price_value           | decimal(30,3)          | Price Value                             |
| Currency                      | currency              | String(3)              | Currency (copied from header if needed) |
| Supply Quantity               | sup_qty               | Integer                | Supply Quantity                         |
| Availability                  | ctm_avail             | String(50)             | Availability                            |
| Supplier Minimum Order Quantity | sup_moq             | Integer                | Supplier Minimum Order Quantity         |
| Created by (Login)           | ctm_clog              | String(255)            | Created By Login                        |
| Updated by (Login)           | ctm_ulog              | String(255)            | Updated By Login                        |
| Created at                   | ctm_cdat              | Date                   | Created At                              |
| Updated at                   | ctm_udat              | Date                   | Updated At                              |
| Item Commodity SAP Code      | ctm_itxt              | String(255)            | CAT : Item Text / Item Commodity Code   |
| Incoterm Location            | ctm_inco              | String(255)            | Incoterm Location                       |
| Coupa Internal Number        | cin                   | String(20)             | Coupa Internal Number                   |
| Coupa Supplier Internal Number | csin                | String(20)             | Coupa Supplier Internal Number          |
| *(none / internal flag)*    | crt_sapoa             | String(10)             | Ready to Create SAP OA                  |
| *(none / internal flag)*    | upd_sapoa             | String(10)             | Ready to Update SAP OA                  |

The `supplier_item_staging` table also maintains existing control fields (`contract_id`, `status`, `sap_oa_number`, `finished_update_sap_oa`, timestamps, etc.) used by the middleware orchestration and by the contracts integration module.


