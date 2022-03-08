
package org.bel.birthdeath.common.model;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Amount {

  @JsonProperty("taxHeadCode")

  private String taxHeadCode = null;

  @JsonProperty("amount")

  private BigDecimal amount = null;
  public Amount taxHeadCode(String taxHeadCode) {
    this.taxHeadCode = taxHeadCode;
    return this;
  }

  

}
